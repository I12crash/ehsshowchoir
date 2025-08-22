const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

// Standard CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json'
};

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        const { httpMethod, resource, pathParameters, queryStringParameters } = event;
        const body = event.body ? JSON.parse(event.body) : {};
        
        // Route requests
        switch (resource) {
            case '/health':
                return await handleHealth();
                
            case '/students':
                return await handleStudents(httpMethod, body, queryStringParameters);
                
            case '/students/{studentId}':
                return await handleStudent(httpMethod, pathParameters.studentId, body);
                
            case '/students/{studentId}/invoice-data':
                return await handleStudentInvoiceData(pathParameters.studentId);
                
            case '/students/{studentId}/payment-history':
                return await handleStudentPaymentHistory(pathParameters.studentId);
                
            case '/invoices/generate-individual':
                return await handleGenerateIndividualInvoice(body);
                
            case '/payment-history':
                return await handlePaymentHistory(httpMethod, body, queryStringParameters);
                
            default:
                return createResponse(404, { error: 'Route not found' });
        }

    } catch (error) {
        console.error('Error:', error);
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

async function handleHealth() {
    return createResponse(200, { 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'ehsshowchoir-api',
        version: '1.0.0'
    });
}

async function handleStudents(method, body, queryParams) {
    switch (method) {
        case 'GET':
            return await getStudents(queryParams);
        case 'POST':
            return await createStudent(body);
        default:
            return createResponse(405, { error: 'Method not allowed' });
    }
}

async function getStudents(queryParams) {
    try {
        const params = {
            TableName: process.env.STUDENTS_TABLE
        };

        // Add filters if provided
        if (queryParams?.status) {
            params.FilterExpression = '#status = :status';
            params.ExpressionAttributeNames = { '#status': 'status' };
            params.ExpressionAttributeValues = { ':status': queryParams.status };
        }
        
        const result = await dynamodb.scan(params).promise();
        
        return createResponse(200, result.Items || []);
    } catch (error) {
        console.error('Error getting students:', error);
        return createResponse(500, { error: 'Failed to retrieve students' });
    }
}

async function createStudent(studentData) {
    try {
        const student = {
            id: `student_${uuidv4()}`,
            ...studentData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'active'
        };
        
        const params = {
            TableName: process.env.STUDENTS_TABLE,
            Item: student
        };
        
        await dynamodb.put(params).promise();
        
        // Also create parent-student relationship
        if (student.parentEmail) {
            await createParentStudentRelationship(student.parentEmail, student.id);
        }
        
        return createResponse(201, student);
    } catch (error) {
        console.error('Error creating student:', error);
        return createResponse(500, { error: 'Failed to create student' });
    }
}

async function createParentStudentRelationship(parentEmail, studentId) {
    try {
        const params = {
            TableName: process.env.PARENT_STUDENT_TABLE,
            Item: {
                parent_email: parentEmail,
                student_id: studentId,
                relationship_type: 'parent',
                created_at: new Date().toISOString()
            }
        };
        
        await dynamodb.put(params).promise();
    } catch (error) {
        console.error('Error creating parent-student relationship:', error);
        // Don't fail the main operation for this
    }
}

async function handleStudent(method, studentId, body) {
    switch (method) {
        case 'GET':
            return await getStudent(studentId);
        case 'PUT':
            return await updateStudent(studentId, body);
        case 'DELETE':
            return await deleteStudent(studentId);
        default:
            return createResponse(405, { error: 'Method not allowed' });
    }
}

async function getStudent(studentId) {
    try {
        const params = {
            TableName: process.env.STUDENTS_TABLE,
            Key: { id: studentId }
        };
        
        const result = await dynamodb.get(params).promise();
        
        if (!result.Item) {
            return createResponse(404, { error: 'Student not found' });
        }
        
        return createResponse(200, result.Item);
    } catch (error) {
        console.error('Error getting student:', error);
        return createResponse(500, { error: 'Failed to retrieve student' });
    }
}

async function updateStudent(studentId, updates) {
    try {
        const params = {
            TableName: process.env.STUDENTS_TABLE,
            Key: { id: studentId },
            UpdateExpression: 'SET #updatedAt = :updatedAt',
            ExpressionAttributeNames: {
                '#updatedAt': 'updatedAt'
            },
            ExpressionAttributeValues: {
                ':updatedAt': new Date().toISOString()
            },
            ReturnValues: 'ALL_NEW'
        };

        // Build update expression dynamically
        Object.keys(updates).forEach((key, index) => {
            if (key !== 'id' && key !== 'createdAt') {
                params.UpdateExpression += `, #${key} = :${key}`;
                params.ExpressionAttributeNames[`#${key}`] = key;
                params.ExpressionAttributeValues[`:${key}`] = updates[key];
            }
        });

        const result = await dynamodb.update(params).promise();
        
        return createResponse(200, result.Attributes);
    } catch (error) {
        console.error('Error updating student:', error);
        return createResponse(500, { error: 'Failed to update student' });
    }
}

async function deleteStudent(studentId) {
    try {
        // First get the student to get parent email
        const student = await getStudent(studentId);
        if (student.statusCode !== 200) {
            return student;
        }
        
        const studentData = JSON.parse(student.body);
        
        // Delete student
        const params = {
            TableName: process.env.STUDENTS_TABLE,
            Key: { id: studentId }
        };
        
        await dynamodb.delete(params).promise();
        
        // Delete parent-student relationship
        if (studentData.parentEmail) {
            await deleteParentStudentRelationship(studentData.parentEmail, studentId);
        }
        
        return createResponse(200, { message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Error deleting student:', error);
        return createResponse(500, { error: 'Failed to delete student' });
    }
}

async function deleteParentStudentRelationship(parentEmail, studentId) {
    try {
        const params = {
            TableName: process.env.PARENT_STUDENT_TABLE,
            Key: {
                parent_email: parentEmail,
                student_id: studentId
            }
        };
        
        await dynamodb.delete(params).promise();
    } catch (error) {
        console.error('Error deleting parent-student relationship:', error);
        // Don't fail the main operation for this
    }
}

async function handleStudentInvoiceData(studentId) {
    try {
        // Get student info
        const studentResponse = await getStudent(studentId);
        if (studentResponse.statusCode !== 200) {
            return studentResponse;
        }
        
        const student = JSON.parse(studentResponse.body);
        
        // Get current charges (pending payments)
        const currentChargesParams = {
            TableName: process.env.PAYMENT_HISTORY_TABLE,
            IndexName: 'StudentIdIndex',
            KeyConditionExpression: 'student_id = :studentId',
            FilterExpression: '#status = :status',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':studentId': studentId,
                ':status': 'pending'
            }
        };

        const currentCharges = await dynamodb.query(currentChargesParams).promise();

        // Get payment history (completed payments)
        const historyParams = {
            TableName: process.env.PAYMENT_HISTORY_TABLE,
            IndexName: 'StudentIdIndex',
            KeyConditionExpression: 'student_id = :studentId',
            FilterExpression: '#status = :status',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':studentId': studentId,
                ':status': 'completed'
            },
            ScanIndexForward: false,
            Limit: 50
        };

        const paymentHistory = await dynamodb.query(historyParams).promise();

        const balanceDue = (currentCharges.Items || []).reduce((sum, item) => sum + (item.amount || 0), 0);
        const totalPaid = (paymentHistory.Items || []).reduce((sum, item) => sum + (item.amount || 0), 0);

        return createResponse(200, {
            student,
            currentCharges: currentCharges.Items || [],
            paymentHistory: paymentHistory.Items || [],
            balanceDue,
            totalPaid
        });
    } catch (error) {
        console.error('Error getting student invoice data:', error);
        return createResponse(500, { error: 'Failed to retrieve invoice data' });
    }
}

async function handleStudentPaymentHistory(studentId) {
    try {
        const params = {
            TableName: process.env.PAYMENT_HISTORY_TABLE,
            IndexName: 'StudentIdIndex',
            KeyConditionExpression: 'student_id = :studentId',
            ExpressionAttributeValues: {
                ':studentId': studentId
            },
            ScanIndexForward: false
        };

        const result = await dynamodb.query(params).promise();

        return createResponse(200, result.Items || []);
    } catch (error) {
        console.error('Error getting payment history:', error);
        return createResponse(500, { error: 'Failed to retrieve payment history' });
    }
}

async function handleGenerateIndividualInvoice(body) {
    try {
        const { studentId, includeHistory, dueDate } = body;
        
        // Get invoice data
        const invoiceDataResponse = await handleStudentInvoiceData(studentId);
        if (invoiceDataResponse.statusCode !== 200) {
            return invoiceDataResponse;
        }
        
        const invoiceData = JSON.parse(invoiceDataResponse.body);
        
        // Generate PDF URL (mock for now - in production, create actual PDF)
        const invoiceId = `invoice_${uuidv4()}`;
        const s3Key = `invoices/${invoiceId}.pdf`;
        
        // Log the invoice generation
        await logInvoiceGeneration(invoiceData.student.parentEmail, [invoiceData.student], s3Key);
        
        // Generate mock PDF URL
        const mockPdfUrl = s3.getSignedUrl('getObject', {
            Bucket: process.env.INVOICES_BUCKET,
            Key: s3Key,
            Expires: 7 * 24 * 60 * 60 // 7 days
        });
        
        return createResponse(200, {
            pdfUrl: mockPdfUrl,
            invoiceData,
            message: 'Invoice generated successfully',
            invoiceId
        });
    } catch (error) {
        console.error('Error generating individual invoice:', error);
        return createResponse(500, { error: 'Failed to generate invoice' });
    }
}

async function handlePaymentHistory(method, body, queryParams) {
    switch (method) {
        case 'GET':
            return await getPaymentHistory(queryParams);
        case 'POST':
            return await createPaymentRecord(body);
        default:
            return createResponse(405, { error: 'Method not allowed' });
    }
}

async function getPaymentHistory(queryParams) {
    try {
        const params = {
            TableName: process.env.PAYMENT_HISTORY_TABLE
        };

        // Add filters
        if (queryParams?.status || queryParams?.type) {
            const filterExpressions = [];
            const expressionAttributeNames = {};
            const expressionAttributeValues = {};

            if (queryParams.status) {
                filterExpressions.push('#status = :status');
                expressionAttributeNames['#status'] = 'status';
                expressionAttributeValues[':status'] = queryParams.status;
            }

            if (queryParams.type) {
                filterExpressions.push('#type = :type');
                expressionAttributeNames['#type'] = 'type';
                expressionAttributeValues[':type'] = queryParams.type;
            }

            params.FilterExpression = filterExpressions.join(' AND ');
            params.ExpressionAttributeNames = expressionAttributeNames;
            params.ExpressionAttributeValues = expressionAttributeValues;
        }
        
        const result = await dynamodb.scan(params).promise();
        
        return createResponse(200, result.Items || []);
    } catch (error) {
        console.error('Error getting payment history:', error);
        return createResponse(500, { error: 'Failed to retrieve payment history' });
    }
}

async function createPaymentRecord(paymentData) {
    try {
        const payment = {
            id: `payment_${uuidv4()}`,
            ...paymentData,
            transaction_date: new Date().toISOString(),
            created_at: new Date().toISOString()
        };
        
        const params = {
            TableName: process.env.PAYMENT_HISTORY_TABLE,
            Item: payment
        };
        
        await dynamodb.put(params).promise();
        
        return createResponse(201, payment);
    } catch (error) {
        console.error('Error creating payment record:', error);
        return createResponse(500, { error: 'Failed to create payment record' });
    }
}

async function logInvoiceGeneration(parentEmail, students, s3Key) {
    try {
        const logEntry = {
            id: `invoice_${uuidv4()}`,
            parent_email: parentEmail,
            student_ids: students.map(s => s.id),
            s3_key: s3Key,
            created_at: new Date().toISOString(),
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
