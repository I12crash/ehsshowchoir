const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES({ region: process.env.AWS_REGION });

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json'
};

exports.bulkInvoiceHandler = async (event) => {
    console.log('Bulk Invoice Event:', JSON.stringify(event, null, 2));

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { invoiceDate, dueDate, includeHistory = true, selectedStudents } = body;

        // Validate required fields
        if (!dueDate) {
            return createResponse(400, { error: 'Due date is required' });
        }

        // Get students
        let students;
        if (selectedStudents && selectedStudents.length > 0) {
            students = await getSpecificStudents(selectedStudents);
        } else {
            students = await getAllActiveStudents();
        }

        console.log(`Processing ${students.length} students`);

        // Group students by parent email
        const studentsByParent = groupStudentsByParent(students);
        console.log(`Sending to ${Object.keys(studentsByParent).length} parents`);

        // Process each parent
        const results = [];
        for (const [parentEmail, parentStudents] of Object.entries(studentsByParent)) {
            try {
                console.log(`Processing parent: ${parentEmail} with ${parentStudents.length} students`);
                
                // Get invoice data for each student
                const invoiceData = await Promise.all(
                    parentStudents.map(student => getStudentInvoiceData(student, includeHistory))
                );

                // Send email
                await sendInvoiceEmail(parentEmail, invoiceData, { invoiceDate, dueDate, includeHistory });

                // Log the invoice generation
                await logInvoiceGeneration(parentEmail, parentStudents);

                results.push({
                    success: true,
                    parentEmail,
                    studentCount: parentStudents.length,
                    studentNames: parentStudents.map(s => s.name)
                });

                console.log(`Successfully processed: ${parentEmail}`);
            } catch (error) {
                console.error(`Error processing ${parentEmail}:`, error);
                results.push({
                    success: false,
                    parentEmail,
                    error: error.message,
                    studentCount: parentStudents.length
                });
            }
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        console.log(`Bulk invoice completed: ${successful} successful, ${failed} failed`);

        return createResponse(200, {
            message: 'Bulk invoice processing completed',
            results: {
                total: results.length,
                successful,
                failed,
                details: results
            }
        });

    } catch (error) {
        console.error('Bulk invoice error:', error);
        return createResponse(500, {
            error: 'Internal server error',
            message: error.message
        });
    }
};

function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify(body)
    };
}

async function getSpecificStudents(studentIds) {
    const students = [];
    
    for (const studentId of studentIds) {
        try {
            const params = {
                TableName: process.env.STUDENTS_TABLE,
                Key: { id: studentId }
            };
            
            const result = await dynamodb.get(params).promise();
            if (result.Item) {
                students.push(result.Item);
            }
        } catch (error) {
            console.error(`Error getting student ${studentId}:`, error);
        }
    }
    
    return students;
}

async function getAllActiveStudents() {
    try {
        const params = {
            TableName: process.env.STUDENTS_TABLE,
            FilterExpression: '#status = :status',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': 'active'
            }
        };

        const result = await dynamodb.scan(params).promise();
        return result.Items || [];
    } catch (error) {
        console.error('Error getting all students:', error);
        throw error;
    }
}

function groupStudentsByParent(students) {
    const grouped = {};
    
    students.forEach(student => {
        if (!grouped[student.parentEmail]) {
            grouped[student.parentEmail] = [];
        }
        grouped[student.parentEmail].push(student);
    });
    
    return grouped;
}

async function getStudentInvoiceData(student, includeHistory) {
    try {
        // Get current charges
        const currentChargesParams = {
            TableName: process.env.PAYMENT_HISTORY_TABLE,
            IndexName: 'StudentIdIndex',
            KeyConditionExpression: 'student_id = :studentId',
            FilterExpression: '#status = :status',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':studentId': student.id,
                ':status': 'pending'
            }
        };

        const currentCharges = await dynamodb.query(currentChargesParams).promise();

        let paymentHistory = [];
        if (includeHistory) {
            const historyParams = {
                TableName: process.env.PAYMENT_HISTORY_TABLE,
                IndexName: 'StudentIdIndex',
                KeyConditionExpression: 'student_id = :studentId',
                FilterExpression: '#status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':studentId': student.id,
                    ':status': 'completed'
                },
                ScanIndexForward: false,
                Limit: 10
            };

            const history = await dynamodb.query(historyParams).promise();
            paymentHistory = history.Items || [];
        }

        const balanceDue = (currentCharges.Items || []).reduce((sum, item) => sum + (item.amount || 0), 0);
        const totalPaid = paymentHistory.reduce((sum, item) => sum + (item.amount || 0), 0);

        return {
            student,
            currentCharges: currentCharges.Items || [],
            paymentHistory,
            balanceDue,
            totalPaid
        };
    } catch (error) {
        console.error(`Error getting invoice data for student ${student.id}:`, error);
        throw error;
    }
}

async function sendInvoiceEmail(parentEmail, invoiceDataArray, options) {
    const studentNames = invoiceDataArray.map(data => data.student.name).join(', ');
    const totalDue = invoiceDataArray.reduce((sum, data) => sum + data.balanceDue, 0);

    const emailParams = {
        Source: process.env.FROM_EMAIL,
        Destination: {
            ToAddresses: [parentEmail]
        },
        Message: {
            Subject: {
                Data: `Edgewood Show Choir Invoice - ${options.invoiceDate || new Date().toLocaleDateString()}`
            },
            Body: {
                Html: {
                    Data: generateEmailHTML(invoiceDataArray, options, totalDue)
                },
                Text: {
                    Data: generateEmailText(invoiceDataArray, options, totalDue)
                }
            }
        },
        ConfigurationSetName: 'ehsshowchoir-emails'
    };

    return await ses.sendEmail(emailParams).promise();
}

function generateEmailHTML(invoiceDataArray, options, totalDue) {
    const studentNames = invoiceDataArray.map(data => data.student.name).join(', ');
    
    const studentSections = invoiceDataArray.map(data => {
        const chargesList = data.currentCharges.length > 0 
            ? data.currentCharges.map(charge => 
                `<p style="margin: 5px 0; padding-left: 15px;">• ${charge.description}: ${charge.amount.toFixed(2)}</p>`
              ).join('')
            : '<p style="margin: 5px 0; padding-left: 15px; color: #27ae60;">No outstanding charges</p>';

        const historySection = options.includeHistory && data.paymentHistory.length > 0
            ? `
            <h4 style="color: #2c3e50; margin-top: 20px;">Recent Payment History:</h4>
            ${data.paymentHistory.slice(0, 5).map(payment => 
                `<p style="margin: 3px 0; padding-left: 15px; font-size: 14px; color: #7f8c8d;">
                    ${new Date(payment.transaction_date).toLocaleDateString()}: ${payment.description} - ${payment.amount.toFixed(2)}
                </p>`
            ).join('')}
            <p style="margin: 10px 0; padding-left: 15px; font-weight: bold;">Total Paid This Year: ${data.totalPaid.toFixed(2)}</p>
            `
            : '';

        return `
        <div style="margin-bottom: 30px; padding: 20px; border-left: 4px solid #e74c3c; background-color: #f8f9fa;">
            <h3 style="color: #2c3e50; margin-top: 0;">${data.student.name} (Grade ${data.student.grade})</h3>
            <h4 style="color: #2c3e50; margin-bottom: 10px;">Current Charges:</h4>
            ${chargesList}
            <p style="margin: 15px 0 0 0; font-size: 18px; font-weight: bold; color: #e74c3c;">
                Balance Due: ${data.balanceDue.toFixed(2)}
            </p>
            ${historySection}
        </div>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Edgewood Show Choir Invoice</title>
    </head>
    <body style="font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #2c3e50 0%, #e74c3c 100%); color: white; padding: 30px; text-align: center;">
                <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Edgewood Show Choir</h1>
                <h2 style="margin: 10px 0 0 0; font-size: 20px; font-weight: normal; opacity: 0.9;">Monthly Invoice</h2>
            </div>
            
            <div style="padding: 30px;">
                <p style="font-size: 16px; margin-bottom: 20px;">Dear Parent/Guardian,</p>
                
                <p style="font-size: 16px; margin-bottom: 25px;">
                    Please find your monthly invoice for the following student(s): <strong>${studentNames}</strong>
                </p>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 25px;">
                    <p style="margin: 5px 0;"><strong>Invoice Date:</strong> ${options.invoiceDate || new Date().toLocaleDateString()}</p>
                    <p style="margin: 5px 0;"><strong>Due Date:</strong> ${options.dueDate}</p>
                </div>
                
                ${studentSections}
                
                <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 5px; margin: 30px 0;">
                    <h3 style="margin: 0; font-size: 24px;">Total Amount Due: ${totalDue.toFixed(2)}</h3>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://${process.env.DOMAIN_NAME}" 
                       style="background-color: #e74c3c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
                        Make Payment Online
                    </a>
                </div>
                
                <p style="font-size: 14px; color: #7f8c8d; margin-top: 30px;">
                    If you have any questions, please contact us at ${process.env.FROM_EMAIL}
                </p>
                
                <p style="font-size: 16px; margin-top: 25px;">
                    Thank you for your continued support!<br>
                    <strong>Edgewood Show Choir Treasurer</strong>
                </p>
            </div>
            
            <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center;">
                <p style="margin: 0; font-size: 12px; opacity: 0.8;">
                    This is an automated message. Please do not reply to this email.
                </p>
                <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.8;">
                    Visit <a href="https://www.edgewoodchoirs.org" style="color: #f39c12;">edgewoodchoirs.org</a> for more information.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
}

function generateEmailText(invoiceDataArray, options, totalDue) {
    const studentNames = invoiceDataArray.map(data => data.student.name).join(', ');
    
    let emailText = `
EDGEWOOD SHOW CHOIR - MONTHLY INVOICE

Dear Parent/Guardian,

Please find your monthly invoice for the following student(s): ${studentNames}

Invoice Date: ${options.invoiceDate || new Date().toLocaleDateString()}
Due Date: ${options.dueDate}

STUDENT DETAILS:
`;

    invoiceDataArray.forEach(data => {
        emailText += `
${data.student.name} (Grade ${data.student.grade})
----------------------------------------
Current Charges:
`;
        if (data.currentCharges.length > 0) {
            data.currentCharges.forEach(charge => {
                emailText += `  • ${charge.description}: ${charge.amount.toFixed(2)}\n`;
            });
        } else {
            emailText += `  • No outstanding charges\n`;
        }
        
        emailText += `Balance Due: ${data.balanceDue.toFixed(2)}\n`;

        if (options.includeHistory && data.paymentHistory.length > 0) {
            emailText += `\nRecent Payment History:\n`;
            data.paymentHistory.slice(0, 5).forEach(payment => {
                emailText += `  ${new Date(payment.transaction_date).toLocaleDateString()}: ${payment.description} - ${payment.amount.toFixed(2)}\n`;
            });
            emailText += `Total Paid This Year: ${data.totalPaid.toFixed(2)}\n`;
        }
        emailText += `\n`;
    });

    emailText += `
TOTAL AMOUNT DUE: ${totalDue.toFixed(2)}

You can make payments online at: https://${process.env.DOMAIN_NAME}

If you have any questions, please contact us at ${process.env.FROM_EMAIL}

Thank you for your continued support!
Edgewood Show Choir Treasurer

---
This is an automated message. Please do not reply to this email.
Visit edgewoodchoirs.org for more information.
`;

    return emailText;
}

async function logInvoiceGeneration(parentEmail, students) {
    try {
        const logEntry = {
            id: `bulk_invoice_${uuidv4()}`,
            parent_email: parentEmail,
            student_ids: students.map(s => s.id),
            student_names: students.map(s => s.name),
            created_at: new Date().toISOString(),
            invoice_type: 'bulk',
            ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year TTL
        };

        const params = {
            TableName: process.env.INVOICE_LOG_TABLE,
            Item: logEntry
        };

        await dynamodb.put(params).promise();
    } catch (error) {
        console.error('Error logging invoice generation:', error);
        // Don't fail the main operation
    }
}
