"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_ses_1 = require("@aws-sdk/client-ses");
const uuid_1 = require("uuid");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: process.env.REGION || 'us-east-2' });
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new client_ses_1.SESClient({ region: process.env.REGION || 'us-east-2' });
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'showchoirtreasurer@gmail.com';
const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};
const handler = async (event, context) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    const path = event.rawPath;
    const method = event.requestContext.http.method;
    // Handle OPTIONS for CORS
    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: '',
        };
    }
    try {
        // Health check
        if (path === '/health' && method === 'GET') {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    region: process.env.REGION || 'us-east-2',
                    tables: {
                        students: process.env.STUDENTS_TABLE,
                        parents: process.env.PARENTS_TABLE,
                        transactions: process.env.TRANSACTIONS_TABLE,
                    }
                }),
            };
        }
        // Check if email is registered parent
        if (path === '/auth/check-parent' && method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const email = body.email?.toLowerCase();
            if (!email || !process.env.PARENTS_TABLE) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        isRegistered: false,
                        message: 'Email not provided or system not configured'
                    }),
                };
            }
            try {
                const result = await docClient.send(new lib_dynamodb_1.ScanCommand({
                    TableName: process.env.PARENTS_TABLE,
                    FilterExpression: 'email = :email',
                    ExpressionAttributeValues: {
                        ':email': email,
                    },
                }));
                const isRegistered = result.Items && result.Items.length > 0;
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        isRegistered,
                        message: isRegistered
                            ? 'Email is registered as a parent'
                            : 'Email is not registered in the system. Please contact the administrator.'
                    }),
                };
            }
            catch (error) {
                console.error('Error checking parent email:', error);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        isRegistered: false,
                        message: 'Error checking registration status'
                    }),
                };
            }
        }
        // Admin check
        if (path === '/admin/check' && method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const userEmail = body.email || '';
            const isAdmin = userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    isAdmin,
                    userEmail,
                    adminEmail: ADMIN_EMAIL,
                }),
            };
        }
        // Students endpoints
        if (path === '/students' || path.startsWith('/students/')) {
            if (method === 'GET' && path === '/students') {
                const params = event.queryStringParameters;
                const schoolYear = params?.schoolYear;
                if (!process.env.STUDENTS_TABLE) {
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify([]),
                    };
                }
                try {
                    const result = await docClient.send(new lib_dynamodb_1.ScanCommand({
                        TableName: process.env.STUDENTS_TABLE,
                    }));
                    let items = result.Items || [];
                    if (schoolYear) {
                        items = items.filter((item) => item.schoolYear === schoolYear);
                    }
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify(items),
                    };
                }
                catch (error) {
                    console.error('Error fetching students:', error);
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify([]),
                    };
                }
            }
            if (method === 'POST' && path === '/students') {
                const body = JSON.parse(event.body || '{}');
                const student = {
                    studentId: (0, uuid_1.v4)(),
                    schoolYear: body.schoolYear || '2024-2025',
                    firstName: body.firstName,
                    lastName: body.lastName,
                    gender: body.gender || 'male',
                    choir: body.choir || [],
                    parentIds: body.parentIds || [],
                    balance: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                if (process.env.STUDENTS_TABLE) {
                    await docClient.send(new lib_dynamodb_1.PutCommand({
                        TableName: process.env.STUDENTS_TABLE,
                        Item: student,
                    }));
                }
                return {
                    statusCode: 201,
                    headers: corsHeaders,
                    body: JSON.stringify(student),
                };
            }
            if (method === 'PUT' && path.startsWith('/students/')) {
                const studentId = path.split('/')[2];
                const body = JSON.parse(event.body || '{}');
                if (process.env.STUDENTS_TABLE) {
                    const getResult = await docClient.send(new lib_dynamodb_1.GetCommand({
                        TableName: process.env.STUDENTS_TABLE,
                        Key: { studentId },
                    }));
                    if (getResult.Item) {
                        const updatedStudent = {
                            ...getResult.Item,
                            ...body,
                            studentId,
                            updatedAt: new Date().toISOString(),
                        };
                        await docClient.send(new lib_dynamodb_1.PutCommand({
                            TableName: process.env.STUDENTS_TABLE,
                            Item: updatedStudent,
                        }));
                        return {
                            statusCode: 200,
                            headers: corsHeaders,
                            body: JSON.stringify(updatedStudent),
                        };
                    }
                }
                return {
                    statusCode: 404,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Student not found' }),
                };
            }
        }
        // Parents endpoints
        if (path === '/parents' || path.startsWith('/parents/')) {
            if (method === 'GET' && path === '/parents') {
                if (!process.env.PARENTS_TABLE) {
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify([]),
                    };
                }
                try {
                    const result = await docClient.send(new lib_dynamodb_1.ScanCommand({
                        TableName: process.env.PARENTS_TABLE,
                    }));
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify(result.Items || []),
                    };
                }
                catch (error) {
                    console.error('Error fetching parents:', error);
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify([]),
                    };
                }
            }
            if (method === 'POST' && path === '/parents') {
                const body = JSON.parse(event.body || '{}');
                const parent = {
                    parentId: (0, uuid_1.v4)(),
                    firstName: body.firstName,
                    lastName: body.lastName,
                    email: body.email.toLowerCase(),
                    phone: body.phone,
                    studentIds: body.studentIds || [],
                    createdAt: new Date().toISOString(),
                };
                if (process.env.PARENTS_TABLE) {
                    await docClient.send(new lib_dynamodb_1.PutCommand({
                        TableName: process.env.PARENTS_TABLE,
                        Item: parent,
                    }));
                }
                return {
                    statusCode: 201,
                    headers: corsHeaders,
                    body: JSON.stringify(parent),
                };
            }
        }
        // Transactions endpoints with editing and audit logging
        if (path === '/transactions' || path.startsWith('/transactions/')) {
            if (method === 'GET' && path === '/transactions') {
                const params = event.queryStringParameters;
                const schoolYear = params?.schoolYear;
                if (!process.env.TRANSACTIONS_TABLE) {
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify([]),
                    };
                }
                try {
                    const result = await docClient.send(new lib_dynamodb_1.ScanCommand({
                        TableName: process.env.TRANSACTIONS_TABLE,
                    }));
                    let items = result.Items || [];
                    if (schoolYear) {
                        items = items.filter((item) => item.schoolYear === schoolYear);
                    }
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify(items),
                    };
                }
                catch (error) {
                    console.error('Error fetching transactions:', error);
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify([]),
                    };
                }
            }
            if (method === 'POST' && path === '/transactions') {
                const body = JSON.parse(event.body || '{}');
                const userEmail = body.userEmail || 'admin';
                const transaction = {
                    transactionId: (0, uuid_1.v4)(),
                    date: body.date || new Date().toISOString().split('T')[0],
                    studentId: body.studentId,
                    schoolYear: body.schoolYear,
                    description: body.description,
                    type: body.type,
                    amount: body.amount,
                    notes: body.notes,
                    createdAt: new Date().toISOString(),
                    createdBy: userEmail,
                    auditLog: [{
                            timestamp: new Date().toISOString(),
                            user: userEmail,
                            action: 'Created transaction',
                        }],
                };
                if (process.env.TRANSACTIONS_TABLE) {
                    await docClient.send(new lib_dynamodb_1.PutCommand({
                        TableName: process.env.TRANSACTIONS_TABLE,
                        Item: transaction,
                    }));
                    // Update student balance
                    if (process.env.STUDENTS_TABLE && transaction.studentId) {
                        const studentResult = await docClient.send(new lib_dynamodb_1.GetCommand({
                            TableName: process.env.STUDENTS_TABLE,
                            Key: { studentId: transaction.studentId },
                        }));
                        if (studentResult.Item) {
                            const currentBalance = studentResult.Item.balance || 0;
                            const balanceChange = transaction.type === 'charge' ? transaction.amount : -transaction.amount;
                            const newBalance = currentBalance + balanceChange;
                            await docClient.send(new lib_dynamodb_1.UpdateCommand({
                                TableName: process.env.STUDENTS_TABLE,
                                Key: { studentId: transaction.studentId },
                                UpdateExpression: 'SET balance = :balance, updatedAt = :now',
                                ExpressionAttributeValues: {
                                    ':balance': newBalance,
                                    ':now': new Date().toISOString(),
                                },
                            }));
                        }
                    }
                }
                return {
                    statusCode: 201,
                    headers: corsHeaders,
                    body: JSON.stringify(transaction),
                };
            }
            // Edit transaction
            if (method === 'PUT' && path.startsWith('/transactions/')) {
                const transactionId = path.split('/')[2];
                const body = JSON.parse(event.body || '{}');
                const userEmail = body.userEmail || 'admin';
                if (!process.env.TRANSACTIONS_TABLE) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: 'Transactions table not configured' }),
                    };
                }
                // Get existing transaction
                const getResult = await docClient.send(new lib_dynamodb_1.GetCommand({
                    TableName: process.env.TRANSACTIONS_TABLE,
                    Key: { transactionId },
                }));
                if (!getResult.Item) {
                    return {
                        statusCode: 404,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: 'Transaction not found' }),
                    };
                }
                const oldTransaction = getResult.Item;
                const oldAmount = oldTransaction.amount;
                const oldType = oldTransaction.type;
                // Create audit entry
                const auditEntry = {
                    timestamp: new Date().toISOString(),
                    user: userEmail,
                    action: 'Modified transaction',
                    changes: {
                        old: {
                            amount: oldAmount,
                            type: oldType,
                            description: oldTransaction.description,
                            date: oldTransaction.date,
                            notes: oldTransaction.notes,
                        },
                        new: {
                            amount: body.amount,
                            type: body.type,
                            description: body.description,
                            date: body.date,
                            notes: body.notes,
                        },
                    },
                };
                const auditLog = [...(oldTransaction.auditLog || []), auditEntry];
                // Update transaction
                const updatedTransaction = {
                    ...oldTransaction,
                    date: body.date || oldTransaction.date,
                    description: body.description || oldTransaction.description,
                    type: body.type || oldTransaction.type,
                    amount: body.amount !== undefined ? body.amount : oldTransaction.amount,
                    notes: body.notes,
                    modifiedAt: new Date().toISOString(),
                    modifiedBy: userEmail,
                    auditLog,
                };
                await docClient.send(new lib_dynamodb_1.PutCommand({
                    TableName: process.env.TRANSACTIONS_TABLE,
                    Item: updatedTransaction,
                }));
                // Update student balance
                if (process.env.STUDENTS_TABLE && updatedTransaction.studentId) {
                    const studentResult = await docClient.send(new lib_dynamodb_1.GetCommand({
                        TableName: process.env.STUDENTS_TABLE,
                        Key: { studentId: updatedTransaction.studentId },
                    }));
                    if (studentResult.Item) {
                        const currentBalance = studentResult.Item.balance || 0;
                        // Reverse old transaction
                        const reverseOld = oldType === 'charge' ? -oldAmount : oldAmount;
                        // Apply new transaction
                        const applyNew = updatedTransaction.type === 'charge' ? updatedTransaction.amount : -updatedTransaction.amount;
                        const newBalance = currentBalance + reverseOld + applyNew;
                        await docClient.send(new lib_dynamodb_1.UpdateCommand({
                            TableName: process.env.STUDENTS_TABLE,
                            Key: { studentId: updatedTransaction.studentId },
                            UpdateExpression: 'SET balance = :balance, updatedAt = :now',
                            ExpressionAttributeValues: {
                                ':balance': newBalance,
                                ':now': new Date().toISOString(),
                            },
                        }));
                    }
                }
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify(updatedTransaction),
                };
            }
            // Delete transaction
            if (method === 'DELETE' && path.startsWith('/transactions/')) {
                const transactionId = path.split('/')[2];
                const params = event.queryStringParameters;
                const userEmail = params?.userEmail || 'admin';
                if (!process.env.TRANSACTIONS_TABLE) {
                    return {
                        statusCode: 400,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: 'Transactions table not configured' }),
                    };
                }
                // Get existing transaction
                const getResult = await docClient.send(new lib_dynamodb_1.GetCommand({
                    TableName: process.env.TRANSACTIONS_TABLE,
                    Key: { transactionId },
                }));
                if (!getResult.Item) {
                    return {
                        statusCode: 404,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: 'Transaction not found' }),
                    };
                }
                const transaction = getResult.Item;
                // Create deleted transaction record with audit log
                const deletedTransaction = {
                    ...transaction,
                    deleted: true,
                    deletedAt: new Date().toISOString(),
                    deletedBy: userEmail,
                    auditLog: [
                        ...(transaction.auditLog || []),
                        {
                            timestamp: new Date().toISOString(),
                            user: userEmail,
                            action: 'Deleted transaction',
                        },
                    ],
                };
                // Update instead of delete to preserve audit trail
                await docClient.send(new lib_dynamodb_1.PutCommand({
                    TableName: process.env.TRANSACTIONS_TABLE,
                    Item: deletedTransaction,
                }));
                // Reverse the balance change
                if (process.env.STUDENTS_TABLE && transaction.studentId) {
                    const studentResult = await docClient.send(new lib_dynamodb_1.GetCommand({
                        TableName: process.env.STUDENTS_TABLE,
                        Key: { studentId: transaction.studentId },
                    }));
                    if (studentResult.Item) {
                        const currentBalance = studentResult.Item.balance || 0;
                        const reverseAmount = transaction.type === 'charge' ? -transaction.amount : transaction.amount;
                        const newBalance = currentBalance + reverseAmount;
                        await docClient.send(new lib_dynamodb_1.UpdateCommand({
                            TableName: process.env.STUDENTS_TABLE,
                            Key: { studentId: transaction.studentId },
                            UpdateExpression: 'SET balance = :balance, updatedAt = :now',
                            ExpressionAttributeValues: {
                                ':balance': newBalance,
                                ':now': new Date().toISOString(),
                            },
                        }));
                    }
                }
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({ message: 'Transaction deleted', transaction: deletedTransaction }),
                };
            }
        }
        // Bulk charge endpoint
        if (path === '/transactions/bulk' && method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { choir, gender, description, amount, date, schoolYear, type, userEmail } = body;
            if (!process.env.STUDENTS_TABLE || !process.env.TRANSACTIONS_TABLE) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Tables not configured' }),
                };
            }
            const studentsResult = await docClient.send(new lib_dynamodb_1.ScanCommand({
                TableName: process.env.STUDENTS_TABLE,
            }));
            let students = studentsResult.Items || [];
            students = students.filter((s) => s.schoolYear === schoolYear);
            students = students.filter((s) => s.choir && s.choir.includes(choir));
            if (choir === 'Music Warehouse' && gender) {
                students = students.filter((s) => s.gender === gender);
            }
            const transactions = [];
            for (const student of students) {
                const transaction = {
                    transactionId: (0, uuid_1.v4)(),
                    date: date || new Date().toISOString().split('T')[0],
                    studentId: student.studentId,
                    schoolYear,
                    description,
                    type: type || 'charge',
                    amount,
                    notes: `Bulk ${type || 'charge'} for ${choir}${gender ? ` (${gender})` : ''}`,
                    createdAt: new Date().toISOString(),
                    createdBy: userEmail || 'admin',
                    auditLog: [{
                            timestamp: new Date().toISOString(),
                            user: userEmail || 'admin',
                            action: `Created bulk ${type || 'charge'}`,
                        }],
                };
                await docClient.send(new lib_dynamodb_1.PutCommand({
                    TableName: process.env.TRANSACTIONS_TABLE,
                    Item: transaction,
                }));
                const currentBalance = student.balance || 0;
                const balanceChange = transaction.type === 'charge' ? amount : -amount;
                const newBalance = currentBalance + balanceChange;
                await docClient.send(new lib_dynamodb_1.UpdateCommand({
                    TableName: process.env.STUDENTS_TABLE,
                    Key: { studentId: student.studentId },
                    UpdateExpression: 'SET balance = :balance, updatedAt = :now',
                    ExpressionAttributeValues: {
                        ':balance': newBalance,
                        ':now': new Date().toISOString(),
                    },
                }));
                transactions.push(transaction);
            }
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    message: `Bulk ${type || 'charge'} applied to ${transactions.length} students`,
                    transactions,
                }),
            };
        }
        // Invoice endpoints with actual email sending
        if (path === '/invoices/send' && method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { studentId, schoolYear, subject, emailBody } = body;
            if (!process.env.STUDENTS_TABLE || !process.env.PARENTS_TABLE || !process.env.TRANSACTIONS_TABLE) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Tables not configured' }),
                };
            }
            // Get student
            const studentResult = await docClient.send(new lib_dynamodb_1.GetCommand({
                TableName: process.env.STUDENTS_TABLE,
                Key: { studentId },
            }));
            if (!studentResult.Item) {
                return {
                    statusCode: 404,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Student not found' }),
                };
            }
            const student = studentResult.Item;
            // Get parent emails
            const parentEmails = [];
            if (student.parentIds && student.parentIds.length > 0) {
                for (const parentId of student.parentIds) {
                    const parentResult = await docClient.send(new lib_dynamodb_1.GetCommand({
                        TableName: process.env.PARENTS_TABLE,
                        Key: { parentId },
                    }));
                    if (parentResult.Item) {
                        parentEmails.push(parentResult.Item.email);
                    }
                }
            }
            if (parentEmails.length === 0) {
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        error: 'No parent emails found',
                        message: 'Please link parents to this student first'
                    }),
                };
            }
            // Get transactions
            const transactionsResult = await docClient.send(new lib_dynamodb_1.ScanCommand({
                TableName: process.env.TRANSACTIONS_TABLE,
                FilterExpression: 'studentId = :sid AND schoolYear = :sy AND (attribute_not_exists(deleted) OR deleted = :false)',
                ExpressionAttributeValues: {
                    ':sid': studentId,
                    ':sy': schoolYear,
                    ':false': false,
                },
            }));
            const transactions = (transactionsResult.Items || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            // Generate invoice HTML
            const invoiceHtml = generateInvoiceHTML(student, transactions, schoolYear, emailBody);
            // Send email
            const emailParams = {
                Source: ADMIN_EMAIL,
                Destination: {
                    ToAddresses: parentEmails,
                },
                Message: {
                    Subject: {
                        Data: subject || `Show Choir Invoice - ${student.firstName} ${student.lastName} (${schoolYear})`,
                    },
                    Body: {
                        Html: {
                            Data: invoiceHtml,
                        },
                    },
                },
            };
            try {
                await sesClient.send(new client_ses_1.SendEmailCommand(emailParams));
                console.log('Invoice email sent successfully to:', parentEmails);
                return {
                    statusCode: 200,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: true,
                        message: `Invoice sent to ${parentEmails.length} parent email(s)`,
                        recipients: parentEmails,
                    }),
                };
            }
            catch (error) {
                console.error('Error sending email:', error);
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({
                        success: false,
                        error: 'Failed to send email',
                        details: error instanceof Error ? error.message : 'Unknown error',
                        note: 'Make sure email addresses are verified in SES',
                    }),
                };
            }
        }
        // Default response
        return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({
                message: 'Not Found',
                path,
                method,
            }),
        };
    }
    catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Internal Server Error',
                details: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};
exports.handler = handler;
function generateInvoiceHTML(student, transactions, schoolYear, customMessage) {
    let totalCharges = 0;
    let totalCredits = 0;
    const transactionRows = transactions.map(t => {
        if (t.type === 'charge') {
            totalCharges += t.amount;
        }
        else {
            totalCredits += t.amount;
        }
        return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${t.date}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${t.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">
          ${t.type === 'charge' ? `$${t.amount.toFixed(2)}` : ''}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">
          ${t.type === 'credit' ? `$${t.amount.toFixed(2)}` : ''}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${t.notes || ''}</td>
      </tr>
    `;
    }).join('');
    const balance = totalCharges - totalCredits;
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          max-width: 800px; 
          margin: 0 auto; 
          padding: 20px;
        }
        .header { 
          background: #2c3e50; 
          color: white; 
          padding: 20px; 
          border-radius: 8px 8px 0 0;
        }
        .content { 
          background: white; 
          padding: 20px; 
          border: 1px solid #ddd;
          border-radius: 0 0 8px 8px;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 20px 0;
        }
        th { 
          background: #34495e; 
          color: white; 
          padding: 10px; 
          text-align: left;
        }
        .summary {
          margin-top: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 4px;
        }
        .balance {
          font-size: 20px;
          font-weight: bold;
          color: ${balance > 0 ? '#e74c3c' : '#27ae60'};
        }
        .custom-message {
          margin: 20px 0;
          padding: 15px;
          background: #e3f2fd;
          border-left: 4px solid #2196f3;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Show Choir Invoice</h1>
        <p>School Year: ${schoolYear}</p>
      </div>
      
      <div class="content">
        <h2>Student Information</h2>
        <p><strong>Name:</strong> ${student.firstName} ${student.lastName}</p>
        <p><strong>Choir(s):</strong> ${student.choir.join(', ')}</p>
        
        ${customMessage ? `
          <div class="custom-message">
            ${customMessage}
          </div>
        ` : ''}
        
        <h2>Transaction Details</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th style="text-align: right;">Charges</th>
              <th style="text-align: right;">Credits</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${transactionRows}
          </tbody>
        </table>
        
        <div class="summary">
          <table style="width: auto; margin-left: auto;">
            <tr>
              <td style="padding: 5px;"><strong>Total Charges:</strong></td>
              <td style="padding: 5px; text-align: right;">$${totalCharges.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 5px;"><strong>Total Credits:</strong></td>
              <td style="padding: 5px; text-align: right;">$${totalCredits.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 5px; border-top: 2px solid #333;">
                <strong>Current Balance:</strong>
              </td>
              <td style="padding: 10px 5px; border-top: 2px solid #333; text-align: right;">
                <span class="balance">
                  $${Math.abs(balance).toFixed(2)} ${balance > 0 ? '(Owed)' : balance < 0 ? '(Credit)' : '(Paid in Full)'}
                </span>
              </td>
            </tr>
          </table>
        </div>
        
        <p style="margin-top: 30px; color: #666; font-size: 12px;">
          This invoice was generated on ${new Date().toLocaleDateString()}.
          If you have any questions, please contact ${ADMIN_EMAIL}.
        </p>
      </div>
    </body>
    </html>
  `;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLDhEQUEwRDtBQUMxRCx3REFBZ0o7QUFDaEosb0RBQWtFO0FBQ2xFLCtCQUFvQztBQUVwQyxNQUFNLFlBQVksR0FBRyxJQUFJLGdDQUFjLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLElBQUksV0FBVyxFQUFFLENBQUMsQ0FBQztBQUN2RixNQUFNLFNBQVMsR0FBRyxxQ0FBc0IsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDNUQsTUFBTSxTQUFTLEdBQUcsSUFBSSxzQkFBUyxDQUFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxJQUFJLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFFL0UsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxXQUFXLElBQUksOEJBQThCLENBQUM7QUFFOUUsTUFBTSxXQUFXLEdBQUc7SUFDbEIsY0FBYyxFQUFFLGtCQUFrQjtJQUNsQyw2QkFBNkIsRUFBRSxHQUFHO0lBQ2xDLDhCQUE4QixFQUFFLDRCQUE0QjtJQUM1RCw4QkFBOEIsRUFBRSw2QkFBNkI7Q0FDOUQsQ0FBQztBQWdESyxNQUFNLE9BQU8sR0FBRyxLQUFLLEVBQzFCLEtBQTZCLEVBQzdCLE9BQWdCLEVBQ2tCLEVBQUU7SUFDcEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFdEQsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztJQUMzQixNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7SUFFaEQsMEJBQTBCO0lBQzFCLElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRSxD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ZUFBZTs7Ozs7Ozs7OERBUWlDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDOzs7OzhEQUl2QixZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzs7Ozs7Ozs7cUJBUWhFLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxnQkFBZ0I7Ozs7Ozs7OzBDQVEvRSxJQUFJLElBQUksRUFBRSxDQUFDLGtCQUFrQixFQUFFO3NEQUNuQixXQUFXOzs7OztHQUs5RCxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUdhdGV3YXlQcm94eUV2ZW50VjIsIEFQSUdhdGV3YXlQcm94eVJlc3VsdFYyLCBDb250ZXh0IH0gZnJvbSAnYXdzLWxhbWJkYSc7XG5pbXBvcnQgeyBEeW5hbW9EQkNsaWVudCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1keW5hbW9kYic7XG5pbXBvcnQgeyBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LCBQdXRDb21tYW5kLCBHZXRDb21tYW5kLCBRdWVyeUNvbW1hbmQsIFVwZGF0ZUNvbW1hbmQsIFNjYW5Db21tYW5kLCBEZWxldGVDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvbGliLWR5bmFtb2RiJztcbmltcG9ydCB7IFNFU0NsaWVudCwgU2VuZEVtYWlsQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1zZXMnO1xuaW1wb3J0IHsgdjQgYXMgdXVpZHY0IH0gZnJvbSAndXVpZCc7XG5cbmNvbnN0IGR5bmFtb0NsaWVudCA9IG5ldyBEeW5hbW9EQkNsaWVudCh7IHJlZ2lvbjogcHJvY2Vzcy5lbnYuUkVHSU9OIHx8ICd1cy1lYXN0LTInIH0pO1xuY29uc3QgZG9jQ2xpZW50ID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKGR5bmFtb0NsaWVudCk7XG5jb25zdCBzZXNDbGllbnQgPSBuZXcgU0VTQ2xpZW50KHsgcmVnaW9uOiBwcm9jZXNzLmVudi5SRUdJT04gfHwgJ3VzLWVhc3QtMicgfSk7XG5cbmNvbnN0IEFETUlOX0VNQUlMID0gcHJvY2Vzcy5lbnYuQURNSU5fRU1BSUwgfHwgJ3Nob3djaG9pcnRyZWFzdXJlckBnbWFpbC5jb20nO1xuXG5jb25zdCBjb3JzSGVhZGVycyA9IHtcbiAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiAnQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24nLFxuICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6ICdHRVQsUE9TVCxQVVQsREVMRVRFLE9QVElPTlMnLFxufTtcblxuaW50ZXJmYWNlIFN0dWRlbnQge1xuICBzdHVkZW50SWQ6IHN0cmluZztcbiAgc2Nob29sWWVhcjogc3RyaW5nO1xuICBmaXJzdE5hbWU6IHN0cmluZztcbiAgbGFzdE5hbWU6IHN0cmluZztcbiAgZ2VuZGVyOiAnbWFsZScgfCAnZmVtYWxlJztcbiAgY2hvaXI6IHN0cmluZ1tdO1xuICBwYXJlbnRJZHM6IHN0cmluZ1tdO1xuICBiYWxhbmNlOiBudW1iZXI7XG4gIGNyZWF0ZWRBdDogc3RyaW5nO1xuICB1cGRhdGVkQXQ6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFBhcmVudCB7XG4gIHBhcmVudElkOiBzdHJpbmc7XG4gIGZpcnN0TmFtZTogc3RyaW5nO1xuICBsYXN0TmFtZTogc3RyaW5nO1xuICBlbWFpbDogc3RyaW5nO1xuICBwaG9uZT86IHN0cmluZztcbiAgc3R1ZGVudElkczogc3RyaW5nW107XG4gIGNyZWF0ZWRBdDogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgVHJhbnNhY3Rpb24ge1xuICB0cmFuc2FjdGlvbklkOiBzdHJpbmc7XG4gIGRhdGU6IHN0cmluZztcbiAgc3R1ZGVudElkOiBzdHJpbmc7XG4gIHNjaG9vbFllYXI6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgdHlwZTogJ2NoYXJnZScgfCAnY3JlZGl0JztcbiAgYW1vdW50OiBudW1iZXI7XG4gIG5vdGVzPzogc3RyaW5nO1xuICBjcmVhdGVkQXQ6IHN0cmluZztcbiAgY3JlYXRlZEJ5OiBzdHJpbmc7XG4gIG1vZGlmaWVkQXQ/OiBzdHJpbmc7XG4gIG1vZGlmaWVkQnk/OiBzdHJpbmc7XG4gIGF1ZGl0TG9nPzogQXVkaXRFbnRyeVtdO1xufVxuXG5pbnRlcmZhY2UgQXVkaXRFbnRyeSB7XG4gIHRpbWVzdGFtcDogc3RyaW5nO1xuICB1c2VyOiBzdHJpbmc7XG4gIGFjdGlvbjogc3RyaW5nO1xuICBjaGFuZ2VzPzogYW55O1xufVxuXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChcbiAgZXZlbnQ6IEFQSUdhdGV3YXlQcm94eUV2ZW50VjIsXG4gIGNvbnRleHQ6IENvbnRleHRcbik6IFByb21pc2U8QVBJR2F0ZXdheVByb3h5UmVzdWx0VjI+ID0+IHtcbiAgY29uc29sZS5sb2coJ0V2ZW50OicsIEpTT04uc3RyaW5naWZ5KGV2ZW50LCBudWxsLCAyKSk7XG5cbiAgY29uc3QgcGF0aCA9IGV2ZW50LnJhd1BhdGg7XG4gIGNvbnN0IG1ldGhvZCA9IGV2ZW50LnJlcXVlc3RDb250ZXh0Lmh0dHAubWV0aG9kO1xuXG4gIC8vIEhhbmRsZSBPUFRJT05TIGZvciBDT1JTXG4gIGlmIChtZXRob2QgPT09ICdPUFRJT05TJykge1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgIGJvZHk6ICcnLFxuICAgIH07XG4gIH1cblxuICB0cnkge1xuICAgIC8vIEhlYWx0aCBjaGVja1xuICAgIGlmIChwYXRoID09PSAnL2hlYWx0aCcgJiYgbWV0aG9kID09PSAnR0VUJykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIHN0YXR1czogJ2hlYWx0aHknLFxuICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuUkVHSU9OIHx8ICd1cy1lYXN0LTInLFxuICAgICAgICAgIHRhYmxlczoge1xuICAgICAgICAgICAgc3R1ZGVudHM6IHByb2Nlc3MuZW52LlNUVURFTlRTX1RBQkxFLFxuICAgICAgICAgICAgcGFyZW50czogcHJvY2Vzcy5lbnYuUEFSRU5UU19UQUJMRSxcbiAgICAgICAgICAgIHRyYW5zYWN0aW9uczogcHJvY2Vzcy5lbnYuVFJBTlNBQ1RJT05TX1RBQkxFLFxuICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIENoZWNrIGlmIGVtYWlsIGlzIHJlZ2lzdGVyZWQgcGFyZW50XG4gICAgaWYgKHBhdGggPT09ICcvYXV0aC9jaGVjay1wYXJlbnQnICYmIG1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICBjb25zdCBib2R5ID0gSlNPTi5wYXJzZShldmVudC5ib2R5IHx8ICd7fScpO1xuICAgICAgY29uc3QgZW1haWwgPSBib2R5LmVtYWlsPy50b0xvd2VyQ2FzZSgpO1xuICAgICAgXG4gICAgICBpZiAoIWVtYWlsIHx8ICFwcm9jZXNzLmVudi5QQVJFTlRTX1RBQkxFKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgXG4gICAgICAgICAgICBpc1JlZ2lzdGVyZWQ6IGZhbHNlLFxuICAgICAgICAgICAgbWVzc2FnZTogJ0VtYWlsIG5vdCBwcm92aWRlZCBvciBzeXN0ZW0gbm90IGNvbmZpZ3VyZWQnXG4gICAgICAgICAgfSksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBTY2FuQ29tbWFuZCh7XG4gICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5QQVJFTlRTX1RBQkxFLFxuICAgICAgICAgIEZpbHRlckV4cHJlc3Npb246ICdlbWFpbCA9IDplbWFpbCcsXG4gICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgICAgICAgJzplbWFpbCc6IGVtYWlsLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pKTtcbiAgICAgICAgXG4gICAgICAgIGNvbnN0IGlzUmVnaXN0ZXJlZCA9IHJlc3VsdC5JdGVtcyAmJiByZXN1bHQuSXRlbXMubGVuZ3RoID4gMDtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgXG4gICAgICAgICAgICBpc1JlZ2lzdGVyZWQsXG4gICAgICAgICAgICBtZXNzYWdlOiBpc1JlZ2lzdGVyZWQgXG4gICAgICAgICAgICAgID8gJ0VtYWlsIGlzIHJlZ2lzdGVyZWQgYXMgYSBwYXJlbnQnIFxuICAgICAgICAgICAgICA6ICdFbWFpbCBpcyBub3QgcmVnaXN0ZXJlZCBpbiB0aGUgc3lzdGVtLiBQbGVhc2UgY29udGFjdCB0aGUgYWRtaW5pc3RyYXRvci4nXG4gICAgICAgICAgfSksXG4gICAgICAgIH07XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBjaGVja2luZyBwYXJlbnQgZW1haWw6JywgZXJyb3IpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN0YXR1c0NvZGU6IDUwMCxcbiAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IFxuICAgICAgICAgICAgaXNSZWdpc3RlcmVkOiBmYWxzZSxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdFcnJvciBjaGVja2luZyByZWdpc3RyYXRpb24gc3RhdHVzJ1xuICAgICAgICAgIH0pLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEFkbWluIGNoZWNrXG4gICAgaWYgKHBhdGggPT09ICcvYWRtaW4vY2hlY2snICYmIG1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICBjb25zdCBib2R5ID0gSlNPTi5wYXJzZShldmVudC5ib2R5IHx8ICd7fScpO1xuICAgICAgY29uc3QgdXNlckVtYWlsID0gYm9keS5lbWFpbCB8fCAnJztcbiAgICAgIGNvbnN0IGlzQWRtaW4gPSB1c2VyRW1haWwudG9Mb3dlckNhc2UoKSA9PT0gQURNSU5fRU1BSUwudG9Mb3dlckNhc2UoKTtcbiAgICAgIFxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGlzQWRtaW4sXG4gICAgICAgICAgdXNlckVtYWlsLFxuICAgICAgICAgIGFkbWluRW1haWw6IEFETUlOX0VNQUlMLFxuICAgICAgICB9KSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gU3R1ZGVudHMgZW5kcG9pbnRzXG4gICAgaWYgKHBhdGggPT09ICcvc3R1ZGVudHMnIHx8IHBhdGguc3RhcnRzV2l0aCgnL3N0dWRlbnRzLycpKSB7XG4gICAgICBpZiAobWV0aG9kID09PSAnR0VUJyAmJiBwYXRoID09PSAnL3N0dWRlbnRzJykge1xuICAgICAgICBjb25zdCBwYXJhbXMgPSBldmVudC5xdWVyeVN0cmluZ1BhcmFtZXRlcnM7XG4gICAgICAgIGNvbnN0IHNjaG9vbFllYXIgPSBwYXJhbXM/LnNjaG9vbFllYXI7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXByb2Nlc3MuZW52LlNUVURFTlRTX1RBQkxFKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoW10pLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBTY2FuQ29tbWFuZCh7XG4gICAgICAgICAgICBUYWJsZU5hbWU6IHByb2Nlc3MuZW52LlNUVURFTlRTX1RBQkxFLFxuICAgICAgICAgIH0pKTtcbiAgICAgICAgICBcbiAgICAgICAgICBsZXQgaXRlbXMgPSByZXN1bHQuSXRlbXMgfHwgW107XG4gICAgICAgICAgaWYgKHNjaG9vbFllYXIpIHtcbiAgICAgICAgICAgIGl0ZW1zID0gaXRlbXMuZmlsdGVyKChpdGVtOiBhbnkpID0+IGl0ZW0uc2Nob29sWWVhciA9PT0gc2Nob29sWWVhcik7XG4gICAgICAgICAgfVxuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGl0ZW1zKSxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGZldGNoaW5nIHN0dWRlbnRzOicsIGVycm9yKTtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShbXSksXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobWV0aG9kID09PSAnUE9TVCcgJiYgcGF0aCA9PT0gJy9zdHVkZW50cycpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IEpTT04ucGFyc2UoZXZlbnQuYm9keSB8fCAne30nKTtcbiAgICAgICAgY29uc3Qgc3R1ZGVudDogU3R1ZGVudCA9IHtcbiAgICAgICAgICBzdHVkZW50SWQ6IHV1aWR2NCgpLFxuICAgICAgICAgIHNjaG9vbFllYXI6IGJvZHkuc2Nob29sWWVhciB8fCAnMjAyNC0yMDI1JyxcbiAgICAgICAgICBmaXJzdE5hbWU6IGJvZHkuZmlyc3ROYW1lLFxuICAgICAgICAgIGxhc3ROYW1lOiBib2R5Lmxhc3ROYW1lLFxuICAgICAgICAgIGdlbmRlcjogYm9keS5nZW5kZXIgfHwgJ21hbGUnLFxuICAgICAgICAgIGNob2lyOiBib2R5LmNob2lyIHx8IFtdLFxuICAgICAgICAgIHBhcmVudElkczogYm9keS5wYXJlbnRJZHMgfHwgW10sXG4gICAgICAgICAgYmFsYW5jZTogMCxcbiAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICB1cGRhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuU1RVREVOVFNfVEFCTEUpIHtcbiAgICAgICAgICBhd2FpdCBkb2NDbGllbnQuc2VuZChuZXcgUHV0Q29tbWFuZCh7XG4gICAgICAgICAgICBUYWJsZU5hbWU6IHByb2Nlc3MuZW52LlNUVURFTlRTX1RBQkxFLFxuICAgICAgICAgICAgSXRlbTogc3R1ZGVudCxcbiAgICAgICAgICB9KSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMSxcbiAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShzdHVkZW50KSxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1ldGhvZCA9PT0gJ1BVVCcgJiYgcGF0aC5zdGFydHNXaXRoKCcvc3R1ZGVudHMvJykpIHtcbiAgICAgICAgY29uc3Qgc3R1ZGVudElkID0gcGF0aC5zcGxpdCgnLycpWzJdO1xuICAgICAgICBjb25zdCBib2R5ID0gSlNPTi5wYXJzZShldmVudC5ib2R5IHx8ICd7fScpO1xuICAgICAgICBcbiAgICAgICAgaWYgKHByb2Nlc3MuZW52LlNUVURFTlRTX1RBQkxFKSB7XG4gICAgICAgICAgY29uc3QgZ2V0UmVzdWx0ID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQobmV3IEdldENvbW1hbmQoe1xuICAgICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5TVFVERU5UU19UQUJMRSxcbiAgICAgICAgICAgIEtleTogeyBzdHVkZW50SWQgfSxcbiAgICAgICAgICB9KSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKGdldFJlc3VsdC5JdGVtKSB7XG4gICAgICAgICAgICBjb25zdCB1cGRhdGVkU3R1ZGVudCA9IHtcbiAgICAgICAgICAgICAgLi4uZ2V0UmVzdWx0Lkl0ZW0sXG4gICAgICAgICAgICAgIC4uLmJvZHksXG4gICAgICAgICAgICAgIHN0dWRlbnRJZCxcbiAgICAgICAgICAgICAgdXBkYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBhd2FpdCBkb2NDbGllbnQuc2VuZChuZXcgUHV0Q29tbWFuZCh7XG4gICAgICAgICAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuU1RVREVOVFNfVEFCTEUsXG4gICAgICAgICAgICAgIEl0ZW06IHVwZGF0ZWRTdHVkZW50LFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh1cGRhdGVkU3R1ZGVudCksXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiA0MDQsXG4gICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ1N0dWRlbnQgbm90IGZvdW5kJyB9KSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBQYXJlbnRzIGVuZHBvaW50c1xuICAgIGlmIChwYXRoID09PSAnL3BhcmVudHMnIHx8IHBhdGguc3RhcnRzV2l0aCgnL3BhcmVudHMvJykpIHtcbiAgICAgIGlmIChtZXRob2QgPT09ICdHRVQnICYmIHBhdGggPT09ICcvcGFyZW50cycpIHtcbiAgICAgICAgaWYgKCFwcm9jZXNzLmVudi5QQVJFTlRTX1RBQkxFKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoW10pLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBTY2FuQ29tbWFuZCh7XG4gICAgICAgICAgICBUYWJsZU5hbWU6IHByb2Nlc3MuZW52LlBBUkVOVFNfVEFCTEUsXG4gICAgICAgICAgfSkpO1xuICAgICAgICAgIFxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlc3VsdC5JdGVtcyB8fCBbXSksXG4gICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBmZXRjaGluZyBwYXJlbnRzOicsIGVycm9yKTtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShbXSksXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobWV0aG9kID09PSAnUE9TVCcgJiYgcGF0aCA9PT0gJy9wYXJlbnRzJykge1xuICAgICAgICBjb25zdCBib2R5ID0gSlNPTi5wYXJzZShldmVudC5ib2R5IHx8ICd7fScpO1xuICAgICAgICBjb25zdCBwYXJlbnQ6IFBhcmVudCA9IHtcbiAgICAgICAgICBwYXJlbnRJZDogdXVpZHY0KCksXG4gICAgICAgICAgZmlyc3ROYW1lOiBib2R5LmZpcnN0TmFtZSxcbiAgICAgICAgICBsYXN0TmFtZTogYm9keS5sYXN0TmFtZSxcbiAgICAgICAgICBlbWFpbDogYm9keS5lbWFpbC50b0xvd2VyQ2FzZSgpLFxuICAgICAgICAgIHBob25lOiBib2R5LnBob25lLFxuICAgICAgICAgIHN0dWRlbnRJZHM6IGJvZHkuc3R1ZGVudElkcyB8fCBbXSxcbiAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuUEFSRU5UU19UQUJMRSkge1xuICAgICAgICAgIGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBQdXRDb21tYW5kKHtcbiAgICAgICAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuUEFSRU5UU19UQUJMRSxcbiAgICAgICAgICAgIEl0ZW06IHBhcmVudCxcbiAgICAgICAgICB9KSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMSxcbiAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXJlbnQpLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFRyYW5zYWN0aW9ucyBlbmRwb2ludHMgd2l0aCBlZGl0aW5nIGFuZCBhdWRpdCBsb2dnaW5nXG4gICAgaWYgKHBhdGggPT09ICcvdHJhbnNhY3Rpb25zJyB8fCBwYXRoLnN0YXJ0c1dpdGgoJy90cmFuc2FjdGlvbnMvJykpIHtcbiAgICAgIGlmIChtZXRob2QgPT09ICdHRVQnICYmIHBhdGggPT09ICcvdHJhbnNhY3Rpb25zJykge1xuICAgICAgICBjb25zdCBwYXJhbXMgPSBldmVudC5xdWVyeVN0cmluZ1BhcmFtZXRlcnM7XG4gICAgICAgIGNvbnN0IHNjaG9vbFllYXIgPSBwYXJhbXM/LnNjaG9vbFllYXI7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXByb2Nlc3MuZW52LlRSQU5TQUNUSU9OU19UQUJMRSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KFtdKSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkb2NDbGllbnQuc2VuZChuZXcgU2NhbkNvbW1hbmQoe1xuICAgICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5UUkFOU0FDVElPTlNfVEFCTEUsXG4gICAgICAgICAgfSkpO1xuICAgICAgICAgIFxuICAgICAgICAgIGxldCBpdGVtcyA9IHJlc3VsdC5JdGVtcyB8fCBbXTtcbiAgICAgICAgICBpZiAoc2Nob29sWWVhcikge1xuICAgICAgICAgICAgaXRlbXMgPSBpdGVtcy5maWx0ZXIoKGl0ZW06IGFueSkgPT4gaXRlbS5zY2hvb2xZZWFyID09PSBzY2hvb2xZZWFyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoaXRlbXMpLFxuICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZmV0Y2hpbmcgdHJhbnNhY3Rpb25zOicsIGVycm9yKTtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShbXSksXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobWV0aG9kID09PSAnUE9TVCcgJiYgcGF0aCA9PT0gJy90cmFuc2FjdGlvbnMnKSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSBKU09OLnBhcnNlKGV2ZW50LmJvZHkgfHwgJ3t9Jyk7XG4gICAgICAgIGNvbnN0IHVzZXJFbWFpbCA9IGJvZHkudXNlckVtYWlsIHx8ICdhZG1pbic7XG4gICAgICAgIFxuICAgICAgICBjb25zdCB0cmFuc2FjdGlvbjogVHJhbnNhY3Rpb24gPSB7XG4gICAgICAgICAgdHJhbnNhY3Rpb25JZDogdXVpZHY0KCksXG4gICAgICAgICAgZGF0ZTogYm9keS5kYXRlIHx8IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdCgnVCcpWzBdLFxuICAgICAgICAgIHN0dWRlbnRJZDogYm9keS5zdHVkZW50SWQsXG4gICAgICAgICAgc2Nob29sWWVhcjogYm9keS5zY2hvb2xZZWFyLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBib2R5LmRlc2NyaXB0aW9uLFxuICAgICAgICAgIHR5cGU6IGJvZHkudHlwZSxcbiAgICAgICAgICBhbW91bnQ6IGJvZHkuYW1vdW50LFxuICAgICAgICAgIG5vdGVzOiBib2R5Lm5vdGVzLFxuICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgIGNyZWF0ZWRCeTogdXNlckVtYWlsLFxuICAgICAgICAgIGF1ZGl0TG9nOiBbe1xuICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICB1c2VyOiB1c2VyRW1haWwsXG4gICAgICAgICAgICBhY3Rpb246ICdDcmVhdGVkIHRyYW5zYWN0aW9uJyxcbiAgICAgICAgICB9XSxcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuVFJBTlNBQ1RJT05TX1RBQkxFKSB7XG4gICAgICAgICAgYXdhaXQgZG9jQ2xpZW50LnNlbmQobmV3IFB1dENvbW1hbmQoe1xuICAgICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5UUkFOU0FDVElPTlNfVEFCTEUsXG4gICAgICAgICAgICBJdGVtOiB0cmFuc2FjdGlvbixcbiAgICAgICAgICB9KSk7XG4gICAgICAgICAgXG4gICAgICAgICAgLy8gVXBkYXRlIHN0dWRlbnQgYmFsYW5jZVxuICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5TVFVERU5UU19UQUJMRSAmJiB0cmFuc2FjdGlvbi5zdHVkZW50SWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHN0dWRlbnRSZXN1bHQgPSBhd2FpdCBkb2NDbGllbnQuc2VuZChuZXcgR2V0Q29tbWFuZCh7XG4gICAgICAgICAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuU1RVREVOVFNfVEFCTEUsXG4gICAgICAgICAgICAgIEtleTogeyBzdHVkZW50SWQ6IHRyYW5zYWN0aW9uLnN0dWRlbnRJZCB9LFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoc3R1ZGVudFJlc3VsdC5JdGVtKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRCYWxhbmNlID0gc3R1ZGVudFJlc3VsdC5JdGVtLmJhbGFuY2UgfHwgMDtcbiAgICAgICAgICAgICAgY29uc3QgYmFsYW5jZUNoYW5nZSA9IHRyYW5zYWN0aW9uLnR5cGUgPT09ICdjaGFyZ2UnID8gdHJhbnNhY3Rpb24uYW1vdW50IDogLXRyYW5zYWN0aW9uLmFtb3VudDtcbiAgICAgICAgICAgICAgY29uc3QgbmV3QmFsYW5jZSA9IGN1cnJlbnRCYWxhbmNlICsgYmFsYW5jZUNoYW5nZTtcbiAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgIGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBVcGRhdGVDb21tYW5kKHtcbiAgICAgICAgICAgICAgICBUYWJsZU5hbWU6IHByb2Nlc3MuZW52LlNUVURFTlRTX1RBQkxFLFxuICAgICAgICAgICAgICAgIEtleTogeyBzdHVkZW50SWQ6IHRyYW5zYWN0aW9uLnN0dWRlbnRJZCB9LFxuICAgICAgICAgICAgICAgIFVwZGF0ZUV4cHJlc3Npb246ICdTRVQgYmFsYW5jZSA9IDpiYWxhbmNlLCB1cGRhdGVkQXQgPSA6bm93JyxcbiAgICAgICAgICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgICAgICAgICAnOmJhbGFuY2UnOiBuZXdCYWxhbmNlLFxuICAgICAgICAgICAgICAgICAgJzpub3cnOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3RhdHVzQ29kZTogMjAxLFxuICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHRyYW5zYWN0aW9uKSxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgLy8gRWRpdCB0cmFuc2FjdGlvblxuICAgICAgaWYgKG1ldGhvZCA9PT0gJ1BVVCcgJiYgcGF0aC5zdGFydHNXaXRoKCcvdHJhbnNhY3Rpb25zLycpKSB7XG4gICAgICAgIGNvbnN0IHRyYW5zYWN0aW9uSWQgPSBwYXRoLnNwbGl0KCcvJylbMl07XG4gICAgICAgIGNvbnN0IGJvZHkgPSBKU09OLnBhcnNlKGV2ZW50LmJvZHkgfHwgJ3t9Jyk7XG4gICAgICAgIGNvbnN0IHVzZXJFbWFpbCA9IGJvZHkudXNlckVtYWlsIHx8ICdhZG1pbic7XG4gICAgICAgIFxuICAgICAgICBpZiAoIXByb2Nlc3MuZW52LlRSQU5TQUNUSU9OU19UQUJMRSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiA0MDAsXG4gICAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdUcmFuc2FjdGlvbnMgdGFibGUgbm90IGNvbmZpZ3VyZWQnIH0pLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEdldCBleGlzdGluZyB0cmFuc2FjdGlvblxuICAgICAgICBjb25zdCBnZXRSZXN1bHQgPSBhd2FpdCBkb2NDbGllbnQuc2VuZChuZXcgR2V0Q29tbWFuZCh7XG4gICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5UUkFOU0FDVElPTlNfVEFCTEUsXG4gICAgICAgICAgS2V5OiB7IHRyYW5zYWN0aW9uSWQgfSxcbiAgICAgICAgfSkpO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFnZXRSZXN1bHQuSXRlbSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiA0MDQsXG4gICAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdUcmFuc2FjdGlvbiBub3QgZm91bmQnIH0pLFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnN0IG9sZFRyYW5zYWN0aW9uID0gZ2V0UmVzdWx0Lkl0ZW0gYXMgVHJhbnNhY3Rpb247XG4gICAgICAgIGNvbnN0IG9sZEFtb3VudCA9IG9sZFRyYW5zYWN0aW9uLmFtb3VudDtcbiAgICAgICAgY29uc3Qgb2xkVHlwZSA9IG9sZFRyYW5zYWN0aW9uLnR5cGU7XG4gICAgICAgIFxuICAgICAgICAvLyBDcmVhdGUgYXVkaXQgZW50cnlcbiAgICAgICAgY29uc3QgYXVkaXRFbnRyeTogQXVkaXRFbnRyeSA9IHtcbiAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICB1c2VyOiB1c2VyRW1haWwsXG4gICAgICAgICAgYWN0aW9uOiAnTW9kaWZpZWQgdHJhbnNhY3Rpb24nLFxuICAgICAgICAgIGNoYW5nZXM6IHtcbiAgICAgICAgICAgIG9sZDoge1xuICAgICAgICAgICAgICBhbW91bnQ6IG9sZEFtb3VudCxcbiAgICAgICAgICAgICAgdHlwZTogb2xkVHlwZSxcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246IG9sZFRyYW5zYWN0aW9uLmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICBkYXRlOiBvbGRUcmFuc2FjdGlvbi5kYXRlLFxuICAgICAgICAgICAgICBub3Rlczogb2xkVHJhbnNhY3Rpb24ubm90ZXMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbmV3OiB7XG4gICAgICAgICAgICAgIGFtb3VudDogYm9keS5hbW91bnQsXG4gICAgICAgICAgICAgIHR5cGU6IGJvZHkudHlwZSxcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246IGJvZHkuZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgIGRhdGU6IGJvZHkuZGF0ZSxcbiAgICAgICAgICAgICAgbm90ZXM6IGJvZHkubm90ZXMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBjb25zdCBhdWRpdExvZyA9IFsuLi4ob2xkVHJhbnNhY3Rpb24uYXVkaXRMb2cgfHwgW10pLCBhdWRpdEVudHJ5XTtcbiAgICAgICAgXG4gICAgICAgIC8vIFVwZGF0ZSB0cmFuc2FjdGlvblxuICAgICAgICBjb25zdCB1cGRhdGVkVHJhbnNhY3Rpb246IFRyYW5zYWN0aW9uID0ge1xuICAgICAgICAgIC4uLm9sZFRyYW5zYWN0aW9uLFxuICAgICAgICAgIGRhdGU6IGJvZHkuZGF0ZSB8fCBvbGRUcmFuc2FjdGlvbi5kYXRlLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiBib2R5LmRlc2NyaXB0aW9uIHx8IG9sZFRyYW5zYWN0aW9uLmRlc2NyaXB0aW9uLFxuICAgICAgICAgIHR5cGU6IGJvZHkudHlwZSB8fCBvbGRUcmFuc2FjdGlvbi50eXBlLFxuICAgICAgICAgIGFtb3VudDogYm9keS5hbW91bnQgIT09IHVuZGVmaW5lZCA/IGJvZHkuYW1vdW50IDogb2xkVHJhbnNhY3Rpb24uYW1vdW50LFxuICAgICAgICAgIG5vdGVzOiBib2R5Lm5vdGVzLFxuICAgICAgICAgIG1vZGlmaWVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICBtb2RpZmllZEJ5OiB1c2VyRW1haWwsXG4gICAgICAgICAgYXVkaXRMb2csXG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBkb2NDbGllbnQuc2VuZChuZXcgUHV0Q29tbWFuZCh7XG4gICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5UUkFOU0FDVElPTlNfVEFCTEUsXG4gICAgICAgICAgSXRlbTogdXBkYXRlZFRyYW5zYWN0aW9uLFxuICAgICAgICB9KSk7XG4gICAgICAgIFxuICAgICAgICAvLyBVcGRhdGUgc3R1ZGVudCBiYWxhbmNlXG4gICAgICAgIGlmIChwcm9jZXNzLmVudi5TVFVERU5UU19UQUJMRSAmJiB1cGRhdGVkVHJhbnNhY3Rpb24uc3R1ZGVudElkKSB7XG4gICAgICAgICAgY29uc3Qgc3R1ZGVudFJlc3VsdCA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBHZXRDb21tYW5kKHtcbiAgICAgICAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuU1RVREVOVFNfVEFCTEUsXG4gICAgICAgICAgICBLZXk6IHsgc3R1ZGVudElkOiB1cGRhdGVkVHJhbnNhY3Rpb24uc3R1ZGVudElkIH0sXG4gICAgICAgICAgfSkpO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmIChzdHVkZW50UmVzdWx0Lkl0ZW0pIHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRCYWxhbmNlID0gc3R1ZGVudFJlc3VsdC5JdGVtLmJhbGFuY2UgfHwgMDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gUmV2ZXJzZSBvbGQgdHJhbnNhY3Rpb25cbiAgICAgICAgICAgIGNvbnN0IHJldmVyc2VPbGQgPSBvbGRUeXBlID09PSAnY2hhcmdlJyA/IC1vbGRBbW91bnQgOiBvbGRBbW91bnQ7XG4gICAgICAgICAgICAvLyBBcHBseSBuZXcgdHJhbnNhY3Rpb25cbiAgICAgICAgICAgIGNvbnN0IGFwcGx5TmV3ID0gdXBkYXRlZFRyYW5zYWN0aW9uLnR5cGUgPT09ICdjaGFyZ2UnID8gdXBkYXRlZFRyYW5zYWN0aW9uLmFtb3VudCA6IC11cGRhdGVkVHJhbnNhY3Rpb24uYW1vdW50O1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCBuZXdCYWxhbmNlID0gY3VycmVudEJhbGFuY2UgKyByZXZlcnNlT2xkICsgYXBwbHlOZXc7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBVcGRhdGVDb21tYW5kKHtcbiAgICAgICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5TVFVERU5UU19UQUJMRSxcbiAgICAgICAgICAgICAgS2V5OiB7IHN0dWRlbnRJZDogdXBkYXRlZFRyYW5zYWN0aW9uLnN0dWRlbnRJZCB9LFxuICAgICAgICAgICAgICBVcGRhdGVFeHByZXNzaW9uOiAnU0VUIGJhbGFuY2UgPSA6YmFsYW5jZSwgdXBkYXRlZEF0ID0gOm5vdycsXG4gICAgICAgICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgICAgICAgICAnOmJhbGFuY2UnOiBuZXdCYWxhbmNlLFxuICAgICAgICAgICAgICAgICc6bm93JzogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkodXBkYXRlZFRyYW5zYWN0aW9uKSxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgLy8gRGVsZXRlIHRyYW5zYWN0aW9uXG4gICAgICBpZiAobWV0aG9kID09PSAnREVMRVRFJyAmJiBwYXRoLnN0YXJ0c1dpdGgoJy90cmFuc2FjdGlvbnMvJykpIHtcbiAgICAgICAgY29uc3QgdHJhbnNhY3Rpb25JZCA9IHBhdGguc3BsaXQoJy8nKVsyXTtcbiAgICAgICAgY29uc3QgcGFyYW1zID0gZXZlbnQucXVlcnlTdHJpbmdQYXJhbWV0ZXJzO1xuICAgICAgICBjb25zdCB1c2VyRW1haWwgPSBwYXJhbXM/LnVzZXJFbWFpbCB8fCAnYWRtaW4nO1xuICAgICAgICBcbiAgICAgICAgaWYgKCFwcm9jZXNzLmVudi5UUkFOU0FDVElPTlNfVEFCTEUpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnVHJhbnNhY3Rpb25zIHRhYmxlIG5vdCBjb25maWd1cmVkJyB9KSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBHZXQgZXhpc3RpbmcgdHJhbnNhY3Rpb25cbiAgICAgICAgY29uc3QgZ2V0UmVzdWx0ID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQobmV3IEdldENvbW1hbmQoe1xuICAgICAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuVFJBTlNBQ1RJT05TX1RBQkxFLFxuICAgICAgICAgIEtleTogeyB0cmFuc2FjdGlvbklkIH0sXG4gICAgICAgIH0pKTtcbiAgICAgICAgXG4gICAgICAgIGlmICghZ2V0UmVzdWx0Lkl0ZW0pIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3RhdHVzQ29kZTogNDA0LFxuICAgICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnVHJhbnNhY3Rpb24gbm90IGZvdW5kJyB9KSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICBjb25zdCB0cmFuc2FjdGlvbiA9IGdldFJlc3VsdC5JdGVtIGFzIFRyYW5zYWN0aW9uO1xuICAgICAgICBcbiAgICAgICAgLy8gQ3JlYXRlIGRlbGV0ZWQgdHJhbnNhY3Rpb24gcmVjb3JkIHdpdGggYXVkaXQgbG9nXG4gICAgICAgIGNvbnN0IGRlbGV0ZWRUcmFuc2FjdGlvbiA9IHtcbiAgICAgICAgICAuLi50cmFuc2FjdGlvbixcbiAgICAgICAgICBkZWxldGVkOiB0cnVlLFxuICAgICAgICAgIGRlbGV0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgIGRlbGV0ZWRCeTogdXNlckVtYWlsLFxuICAgICAgICAgIGF1ZGl0TG9nOiBbXG4gICAgICAgICAgICAuLi4odHJhbnNhY3Rpb24uYXVkaXRMb2cgfHwgW10pLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgdXNlcjogdXNlckVtYWlsLFxuICAgICAgICAgICAgICBhY3Rpb246ICdEZWxldGVkIHRyYW5zYWN0aW9uJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfTtcbiAgICAgICAgXG4gICAgICAgIC8vIFVwZGF0ZSBpbnN0ZWFkIG9mIGRlbGV0ZSB0byBwcmVzZXJ2ZSBhdWRpdCB0cmFpbFxuICAgICAgICBhd2FpdCBkb2NDbGllbnQuc2VuZChuZXcgUHV0Q29tbWFuZCh7XG4gICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5UUkFOU0FDVElPTlNfVEFCTEUsXG4gICAgICAgICAgSXRlbTogZGVsZXRlZFRyYW5zYWN0aW9uLFxuICAgICAgICB9KSk7XG4gICAgICAgIFxuICAgICAgICAvLyBSZXZlcnNlIHRoZSBiYWxhbmNlIGNoYW5nZVxuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuU1RVREVOVFNfVEFCTEUgJiYgdHJhbnNhY3Rpb24uc3R1ZGVudElkKSB7XG4gICAgICAgICAgY29uc3Qgc3R1ZGVudFJlc3VsdCA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBHZXRDb21tYW5kKHtcbiAgICAgICAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuU1RVREVOVFNfVEFCTEUsXG4gICAgICAgICAgICBLZXk6IHsgc3R1ZGVudElkOiB0cmFuc2FjdGlvbi5zdHVkZW50SWQgfSxcbiAgICAgICAgICB9KSk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKHN0dWRlbnRSZXN1bHQuSXRlbSkge1xuICAgICAgICAgICAgY29uc3QgY3VycmVudEJhbGFuY2UgPSBzdHVkZW50UmVzdWx0Lkl0ZW0uYmFsYW5jZSB8fCAwO1xuICAgICAgICAgICAgY29uc3QgcmV2ZXJzZUFtb3VudCA9IHRyYW5zYWN0aW9uLnR5cGUgPT09ICdjaGFyZ2UnID8gLXRyYW5zYWN0aW9uLmFtb3VudCA6IHRyYW5zYWN0aW9uLmFtb3VudDtcbiAgICAgICAgICAgIGNvbnN0IG5ld0JhbGFuY2UgPSBjdXJyZW50QmFsYW5jZSArIHJldmVyc2VBbW91bnQ7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBVcGRhdGVDb21tYW5kKHtcbiAgICAgICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5TVFVERU5UU19UQUJMRSxcbiAgICAgICAgICAgICAgS2V5OiB7IHN0dWRlbnRJZDogdHJhbnNhY3Rpb24uc3R1ZGVudElkIH0sXG4gICAgICAgICAgICAgIFVwZGF0ZUV4cHJlc3Npb246ICdTRVQgYmFsYW5jZSA9IDpiYWxhbmNlLCB1cGRhdGVkQXQgPSA6bm93JyxcbiAgICAgICAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgICAgICAgICAgICc6YmFsYW5jZSc6IG5ld0JhbGFuY2UsXG4gICAgICAgICAgICAgICAgJzpub3cnOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IG1lc3NhZ2U6ICdUcmFuc2FjdGlvbiBkZWxldGVkJywgdHJhbnNhY3Rpb246IGRlbGV0ZWRUcmFuc2FjdGlvbiB9KSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBCdWxrIGNoYXJnZSBlbmRwb2ludFxuICAgIGlmIChwYXRoID09PSAnL3RyYW5zYWN0aW9ucy9idWxrJyAmJiBtZXRob2QgPT09ICdQT1NUJykge1xuICAgICAgY29uc3QgYm9keSA9IEpTT04ucGFyc2UoZXZlbnQuYm9keSB8fCAne30nKTtcbiAgICAgIGNvbnN0IHsgY2hvaXIsIGdlbmRlciwgZGVzY3JpcHRpb24sIGFtb3VudCwgZGF0ZSwgc2Nob29sWWVhciwgdHlwZSwgdXNlckVtYWlsIH0gPSBib2R5O1xuICAgICAgXG4gICAgICBpZiAoIXByb2Nlc3MuZW52LlNUVURFTlRTX1RBQkxFIHx8ICFwcm9jZXNzLmVudi5UUkFOU0FDVElPTlNfVEFCTEUpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiA0MDAsXG4gICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ1RhYmxlcyBub3QgY29uZmlndXJlZCcgfSksXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBcbiAgICAgIGNvbnN0IHN0dWRlbnRzUmVzdWx0ID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQobmV3IFNjYW5Db21tYW5kKHtcbiAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5TVFVERU5UU19UQUJMRSxcbiAgICAgIH0pKTtcbiAgICAgIFxuICAgICAgbGV0IHN0dWRlbnRzID0gc3R1ZGVudHNSZXN1bHQuSXRlbXMgfHwgW107XG4gICAgICBzdHVkZW50cyA9IHN0dWRlbnRzLmZpbHRlcigoczogYW55KSA9PiBzLnNjaG9vbFllYXIgPT09IHNjaG9vbFllYXIpO1xuICAgICAgc3R1ZGVudHMgPSBzdHVkZW50cy5maWx0ZXIoKHM6IGFueSkgPT4gcy5jaG9pciAmJiBzLmNob2lyLmluY2x1ZGVzKGNob2lyKSk7XG4gICAgICBcbiAgICAgIGlmIChjaG9pciA9PT0gJ011c2ljIFdhcmVob3VzZScgJiYgZ2VuZGVyKSB7XG4gICAgICAgIHN0dWRlbnRzID0gc3R1ZGVudHMuZmlsdGVyKChzOiBhbnkpID0+IHMuZ2VuZGVyID09PSBnZW5kZXIpO1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCB0cmFuc2FjdGlvbnMgPSBbXTtcbiAgICAgIGZvciAoY29uc3Qgc3R1ZGVudCBvZiBzdHVkZW50cykge1xuICAgICAgICBjb25zdCB0cmFuc2FjdGlvbjogVHJhbnNhY3Rpb24gPSB7XG4gICAgICAgICAgdHJhbnNhY3Rpb25JZDogdXVpZHY0KCksXG4gICAgICAgICAgZGF0ZTogZGF0ZSB8fCBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc3BsaXQoJ1QnKVswXSxcbiAgICAgICAgICBzdHVkZW50SWQ6IHN0dWRlbnQuc3R1ZGVudElkLFxuICAgICAgICAgIHNjaG9vbFllYXIsXG4gICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgICAgdHlwZTogdHlwZSB8fCAnY2hhcmdlJyxcbiAgICAgICAgICBhbW91bnQsXG4gICAgICAgICAgbm90ZXM6IGBCdWxrICR7dHlwZSB8fCAnY2hhcmdlJ30gZm9yICR7Y2hvaXJ9JHtnZW5kZXIgPyBgICgke2dlbmRlcn0pYCA6ICcnfWAsXG4gICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgY3JlYXRlZEJ5OiB1c2VyRW1haWwgfHwgJ2FkbWluJyxcbiAgICAgICAgICBhdWRpdExvZzogW3tcbiAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgdXNlcjogdXNlckVtYWlsIHx8ICdhZG1pbicsXG4gICAgICAgICAgICBhY3Rpb246IGBDcmVhdGVkIGJ1bGsgJHt0eXBlIHx8ICdjaGFyZ2UnfWAsXG4gICAgICAgICAgfV0sXG4gICAgICAgIH07XG4gICAgICAgIFxuICAgICAgICBhd2FpdCBkb2NDbGllbnQuc2VuZChuZXcgUHV0Q29tbWFuZCh7XG4gICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5UUkFOU0FDVElPTlNfVEFCTEUhLFxuICAgICAgICAgIEl0ZW06IHRyYW5zYWN0aW9uLFxuICAgICAgICB9KSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjdXJyZW50QmFsYW5jZSA9IHN0dWRlbnQuYmFsYW5jZSB8fCAwO1xuICAgICAgICBjb25zdCBiYWxhbmNlQ2hhbmdlID0gdHJhbnNhY3Rpb24udHlwZSA9PT0gJ2NoYXJnZScgPyBhbW91bnQgOiAtYW1vdW50O1xuICAgICAgICBjb25zdCBuZXdCYWxhbmNlID0gY3VycmVudEJhbGFuY2UgKyBiYWxhbmNlQ2hhbmdlO1xuICAgICAgICBcbiAgICAgICAgYXdhaXQgZG9jQ2xpZW50LnNlbmQobmV3IFVwZGF0ZUNvbW1hbmQoe1xuICAgICAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuU1RVREVOVFNfVEFCTEUhLFxuICAgICAgICAgIEtleTogeyBzdHVkZW50SWQ6IHN0dWRlbnQuc3R1ZGVudElkIH0sXG4gICAgICAgICAgVXBkYXRlRXhwcmVzc2lvbjogJ1NFVCBiYWxhbmNlID0gOmJhbGFuY2UsIHVwZGF0ZWRBdCA9IDpub3cnLFxuICAgICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgICAgICc6YmFsYW5jZSc6IG5ld0JhbGFuY2UsXG4gICAgICAgICAgICAnOm5vdyc6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSk7XG4gICAgICAgIFxuICAgICAgICB0cmFuc2FjdGlvbnMucHVzaCh0cmFuc2FjdGlvbik7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBtZXNzYWdlOiBgQnVsayAke3R5cGUgfHwgJ2NoYXJnZSd9IGFwcGxpZWQgdG8gJHt0cmFuc2FjdGlvbnMubGVuZ3RofSBzdHVkZW50c2AsXG4gICAgICAgICAgdHJhbnNhY3Rpb25zLFxuICAgICAgICB9KSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gSW52b2ljZSBlbmRwb2ludHMgd2l0aCBhY3R1YWwgZW1haWwgc2VuZGluZ1xuICAgIGlmIChwYXRoID09PSAnL2ludm9pY2VzL3NlbmQnICYmIG1ldGhvZCA9PT0gJ1BPU1QnKSB7XG4gICAgICBjb25zdCBib2R5ID0gSlNPTi5wYXJzZShldmVudC5ib2R5IHx8ICd7fScpO1xuICAgICAgY29uc3QgeyBzdHVkZW50SWQsIHNjaG9vbFllYXIsIHN1YmplY3QsIGVtYWlsQm9keSB9ID0gYm9keTtcbiAgICAgIFxuICAgICAgaWYgKCFwcm9jZXNzLmVudi5TVFVERU5UU19UQUJMRSB8fCAhcHJvY2Vzcy5lbnYuUEFSRU5UU19UQUJMRSB8fCAhcHJvY2Vzcy5lbnYuVFJBTlNBQ1RJT05TX1RBQkxFKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdUYWJsZXMgbm90IGNvbmZpZ3VyZWQnIH0pLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgXG4gICAgICAvLyBHZXQgc3R1ZGVudFxuICAgICAgY29uc3Qgc3R1ZGVudFJlc3VsdCA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKG5ldyBHZXRDb21tYW5kKHtcbiAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5TVFVERU5UU19UQUJMRSxcbiAgICAgICAgS2V5OiB7IHN0dWRlbnRJZCB9LFxuICAgICAgfSkpO1xuICAgICAgXG4gICAgICBpZiAoIXN0dWRlbnRSZXN1bHQuSXRlbSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN0YXR1c0NvZGU6IDQwNCxcbiAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnU3R1ZGVudCBub3QgZm91bmQnIH0pLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgXG4gICAgICBjb25zdCBzdHVkZW50ID0gc3R1ZGVudFJlc3VsdC5JdGVtIGFzIFN0dWRlbnQ7XG4gICAgICBcbiAgICAgIC8vIEdldCBwYXJlbnQgZW1haWxzXG4gICAgICBjb25zdCBwYXJlbnRFbWFpbHM6IHN0cmluZ1tdID0gW107XG4gICAgICBpZiAoc3R1ZGVudC5wYXJlbnRJZHMgJiYgc3R1ZGVudC5wYXJlbnRJZHMubGVuZ3RoID4gMCkge1xuICAgICAgICBmb3IgKGNvbnN0IHBhcmVudElkIG9mIHN0dWRlbnQucGFyZW50SWRzKSB7XG4gICAgICAgICAgY29uc3QgcGFyZW50UmVzdWx0ID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQobmV3IEdldENvbW1hbmQoe1xuICAgICAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5QQVJFTlRTX1RBQkxFLFxuICAgICAgICAgICAgS2V5OiB7IHBhcmVudElkIH0sXG4gICAgICAgICAgfSkpO1xuICAgICAgICAgIGlmIChwYXJlbnRSZXN1bHQuSXRlbSkge1xuICAgICAgICAgICAgcGFyZW50RW1haWxzLnB1c2gocGFyZW50UmVzdWx0Lkl0ZW0uZW1haWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAocGFyZW50RW1haWxzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHN0YXR1c0NvZGU6IDQwMCxcbiAgICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IFxuICAgICAgICAgICAgZXJyb3I6ICdObyBwYXJlbnQgZW1haWxzIGZvdW5kJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdQbGVhc2UgbGluayBwYXJlbnRzIHRvIHRoaXMgc3R1ZGVudCBmaXJzdCdcbiAgICAgICAgICB9KSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gR2V0IHRyYW5zYWN0aW9uc1xuICAgICAgY29uc3QgdHJhbnNhY3Rpb25zUmVzdWx0ID0gYXdhaXQgZG9jQ2xpZW50LnNlbmQobmV3IFNjYW5Db21tYW5kKHtcbiAgICAgICAgVGFibGVOYW1lOiBwcm9jZXNzLmVudi5UUkFOU0FDVElPTlNfVEFCTEUsXG4gICAgICAgIEZpbHRlckV4cHJlc3Npb246ICdzdHVkZW50SWQgPSA6c2lkIEFORCBzY2hvb2xZZWFyID0gOnN5IEFORCAoYXR0cmlidXRlX25vdF9leGlzdHMoZGVsZXRlZCkgT1IgZGVsZXRlZCA9IDpmYWxzZSknLFxuICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgJzpzaWQnOiBzdHVkZW50SWQsXG4gICAgICAgICAgJzpzeSc6IHNjaG9vbFllYXIsXG4gICAgICAgICAgJzpmYWxzZSc6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgfSkpO1xuICAgICAgXG4gICAgICBjb25zdCB0cmFuc2FjdGlvbnMgPSAodHJhbnNhY3Rpb25zUmVzdWx0Lkl0ZW1zIHx8IFtdKS5zb3J0KChhOiBhbnksIGI6IGFueSkgPT4gXG4gICAgICAgIG5ldyBEYXRlKGEuZGF0ZSkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYi5kYXRlKS5nZXRUaW1lKClcbiAgICAgICk7XG4gICAgICBcbiAgICAgIC8vIEdlbmVyYXRlIGludm9pY2UgSFRNTFxuICAgICAgY29uc3QgaW52b2ljZUh0bWwgPSBnZW5lcmF0ZUludm9pY2VIVE1MKHN0dWRlbnQsIHRyYW5zYWN0aW9ucywgc2Nob29sWWVhciwgZW1haWxCb2R5KTtcbiAgICAgIFxuICAgICAgLy8gU2VuZCBlbWFpbFxuICAgICAgY29uc3QgZW1haWxQYXJhbXMgPSB7XG4gICAgICAgIFNvdXJjZTogQURNSU5fRU1BSUwsXG4gICAgICAgIERlc3RpbmF0aW9uOiB7XG4gICAgICAgICAgVG9BZGRyZXNzZXM6IHBhcmVudEVtYWlscyxcbiAgICAgICAgfSxcbiAgICAgICAgTWVzc2FnZToge1xuICAgICAgICAgIFN1YmplY3Q6IHtcbiAgICAgICAgICAgIERhdGE6IHN1YmplY3QgfHwgYFNob3cgQ2hvaXIgSW52b2ljZSAtICR7c3R1ZGVudC5maXJzdE5hbWV9ICR7c3R1ZGVudC5sYXN0TmFtZX0gKCR7c2Nob29sWWVhcn0pYCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIEJvZHk6IHtcbiAgICAgICAgICAgIEh0bWw6IHtcbiAgICAgICAgICAgICAgRGF0YTogaW52b2ljZUh0bWwsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgICAgXG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBzZXNDbGllbnQuc2VuZChuZXcgU2VuZEVtYWlsQ29tbWFuZChlbWFpbFBhcmFtcykpO1xuICAgICAgICBjb25zb2xlLmxvZygnSW52b2ljZSBlbWFpbCBzZW50IHN1Y2Nlc3NmdWxseSB0bzonLCBwYXJlbnRFbWFpbHMpO1xuICAgICAgICBcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBJbnZvaWNlIHNlbnQgdG8gJHtwYXJlbnRFbWFpbHMubGVuZ3RofSBwYXJlbnQgZW1haWwocylgLFxuICAgICAgICAgICAgcmVjaXBpZW50czogcGFyZW50RW1haWxzLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9O1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3Igc2VuZGluZyBlbWFpbDonLCBlcnJvcik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3RhdHVzQ29kZTogNTAwLFxuICAgICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzLFxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgZXJyb3I6ICdGYWlsZWQgdG8gc2VuZCBlbWFpbCcsXG4gICAgICAgICAgICBkZXRhaWxzOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6ICdVbmtub3duIGVycm9yJyxcbiAgICAgICAgICAgIG5vdGU6ICdNYWtlIHN1cmUgZW1haWwgYWRkcmVzc2VzIGFyZSB2ZXJpZmllZCBpbiBTRVMnLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9O1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIERlZmF1bHQgcmVzcG9uc2VcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogNDA0LFxuICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMsXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIG1lc3NhZ2U6ICdOb3QgRm91bmQnLFxuICAgICAgICBwYXRoLFxuICAgICAgICBtZXRob2QsXG4gICAgICB9KSxcbiAgICB9O1xuXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3I6JywgZXJyb3IpO1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiA1MDAsXG4gICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycyxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgZXJyb3I6ICdJbnRlcm5hbCBTZXJ2ZXIgRXJyb3InLFxuICAgICAgICBkZXRhaWxzOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6ICdVbmtub3duIGVycm9yJyxcbiAgICAgIH0pLFxuICAgIH07XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGdlbmVyYXRlSW52b2ljZUhUTUwoc3R1ZGVudDogU3R1ZGVudCwgdHJhbnNhY3Rpb25zOiBhbnlbXSwgc2Nob29sWWVhcjogc3RyaW5nLCBjdXN0b21NZXNzYWdlPzogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHRvdGFsQ2hhcmdlcyA9IDA7XG4gIGxldCB0b3RhbENyZWRpdHMgPSAwO1xuICBcbiAgY29uc3QgdHJhbnNhY3Rpb25Sb3dzID0gdHJhbnNhY3Rpb25zLm1hcCh0ID0+IHtcbiAgICBpZiAodC50eXBlID09PSAnY2hhcmdlJykge1xuICAgICAgdG90YWxDaGFyZ2VzICs9IHQuYW1vdW50O1xuICAgIH0gZWxzZSB7XG4gICAgICB0b3RhbENyZWRpdHMgKz0gdC5hbW91bnQ7XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBgXG4gICAgICA8dHI+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDsgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNkZGQ7XCI+JHt0LmRhdGV9PC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4OyBib3JkZXItYm90dG9tOiAxcHggc29saWQgI2RkZDtcIj4ke3QuZGVzY3JpcHRpb259PC90ZD5cbiAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogOHB4OyBib3JkZXItYm90dG9tOiAxcHggc29saWQgI2RkZDsgdGV4dC1hbGlnbjogcmlnaHQ7XCI+XG4gICAgICAgICAgJHt0LnR5cGUgPT09ICdjaGFyZ2UnID8gYCQke3QuYW1vdW50LnRvRml4ZWQoMil9YCA6ICcnfVxuICAgICAgICA8L3RkPlxuICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA4cHg7IGJvcmRlci1ib3R0b206IDFweCBzb2xpZCAjZGRkOyB0ZXh0LWFsaWduOiByaWdodDtcIj5cbiAgICAgICAgICAke3QudHlwZSA9PT0gJ2NyZWRpdCcgPyBgJCR7dC5hbW91bnQudG9GaXhlZCgyKX1gIDogJyd9XG4gICAgICAgIDwvdGQ+XG4gICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDhweDsgYm9yZGVyLWJvdHRvbTogMXB4IHNvbGlkICNkZGQ7XCI+JHt0Lm5vdGVzIHx8ICcnfTwvdGQ+XG4gICAgICA8L3RyPlxuICAgIGA7XG4gIH0pLmpvaW4oJycpO1xuICBcbiAgY29uc3QgYmFsYW5jZSA9IHRvdGFsQ2hhcmdlcyAtIHRvdGFsQ3JlZGl0cztcbiAgXG4gIHJldHVybiBgXG4gICAgPCFET0NUWVBFIGh0bWw+XG4gICAgPGh0bWw+XG4gICAgPGhlYWQ+XG4gICAgICA8c3R5bGU+XG4gICAgICAgIGJvZHkgeyBcbiAgICAgICAgICBmb250LWZhbWlseTogQXJpYWwsIHNhbnMtc2VyaWY7IFxuICAgICAgICAgIG1heC13aWR0aDogODAwcHg7IFxuICAgICAgICAgIG1hcmdpbjogMCBhdXRvOyBcbiAgICAgICAgICBwYWRkaW5nOiAyMHB4O1xuICAgICAgICB9XG4gICAgICAgIC5oZWFkZXIgeyBcbiAgICAgICAgICBiYWNrZ3JvdW5kOiAjMmMzZTUwOyBcbiAgICAgICAgICBjb2xvcjogd2hpdGU7IFxuICAgICAgICAgIHBhZGRpbmc6IDIwcHg7IFxuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDhweCA4cHggMCAwO1xuICAgICAgICB9XG4gICAgICAgIC5jb250ZW50IHsgXG4gICAgICAgICAgYmFja2dyb3VuZDogd2hpdGU7IFxuICAgICAgICAgIHBhZGRpbmc6IDIwcHg7IFxuICAgICAgICAgIGJvcmRlcjogMXB4IHNvbGlkICNkZGQ7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogMCAwIDhweCA4cHg7XG4gICAgICAgIH1cbiAgICAgICAgdGFibGUgeyBcbiAgICAgICAgICB3aWR0aDogMTAwJTsgXG4gICAgICAgICAgYm9yZGVyLWNvbGxhcHNlOiBjb2xsYXBzZTsgXG4gICAgICAgICAgbWFyZ2luOiAyMHB4IDA7XG4gICAgICAgIH1cbiAgICAgICAgdGggeyBcbiAgICAgICAgICBiYWNrZ3JvdW5kOiAjMzQ0OTVlOyBcbiAgICAgICAgICBjb2xvcjogd2hpdGU7IFxuICAgICAgICAgIHBhZGRpbmc6IDEwcHg7IFxuICAgICAgICAgIHRleHQtYWxpZ246IGxlZnQ7XG4gICAgICAgIH1cbiAgICAgICAgLnN1bW1hcnkge1xuICAgICAgICAgIG1hcmdpbi10b3A6IDIwcHg7XG4gICAgICAgICAgcGFkZGluZzogMTVweDtcbiAgICAgICAgICBiYWNrZ3JvdW5kOiAjZjhmOWZhO1xuICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICAgICAgfVxuICAgICAgICAuYmFsYW5jZSB7XG4gICAgICAgICAgZm9udC1zaXplOiAyMHB4O1xuICAgICAgICAgIGZvbnQtd2VpZ2h0OiBib2xkO1xuICAgICAgICAgIGNvbG9yOiAke2JhbGFuY2UgPiAwID8gJyNlNzRjM2MnIDogJyMyN2FlNjAnfTtcbiAgICAgICAgfVxuICAgICAgICAuY3VzdG9tLW1lc3NhZ2Uge1xuICAgICAgICAgIG1hcmdpbjogMjBweCAwO1xuICAgICAgICAgIHBhZGRpbmc6IDE1cHg7XG4gICAgICAgICAgYmFja2dyb3VuZDogI2UzZjJmZDtcbiAgICAgICAgICBib3JkZXItbGVmdDogNHB4IHNvbGlkICMyMTk2ZjM7XG4gICAgICAgICAgYm9yZGVyLXJhZGl1czogNHB4O1xuICAgICAgICB9XG4gICAgICA8L3N0eWxlPlxuICAgIDwvaGVhZD5cbiAgICA8Ym9keT5cbiAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXJcIj5cbiAgICAgICAgPGgxPlNob3cgQ2hvaXIgSW52b2ljZTwvaDE+XG4gICAgICAgIDxwPlNjaG9vbCBZZWFyOiAke3NjaG9vbFllYXJ9PC9wPlxuICAgICAgPC9kaXY+XG4gICAgICBcbiAgICAgIDxkaXYgY2xhc3M9XCJjb250ZW50XCI+XG4gICAgICAgIDxoMj5TdHVkZW50IEluZm9ybWF0aW9uPC9oMj5cbiAgICAgICAgPHA+PHN0cm9uZz5OYW1lOjwvc3Ryb25nPiAke3N0dWRlbnQuZmlyc3ROYW1lfSAke3N0dWRlbnQubGFzdE5hbWV9PC9wPlxuICAgICAgICA8cD48c3Ryb25nPkNob2lyKHMpOjwvc3Ryb25nPiAke3N0dWRlbnQuY2hvaXIuam9pbignLCAnKX08L3A+XG4gICAgICAgIFxuICAgICAgICAke2N1c3RvbU1lc3NhZ2UgPyBgXG4gICAgICAgICAgPGRpdiBjbGFzcz1cImN1c3RvbS1tZXNzYWdlXCI+XG4gICAgICAgICAgICAke2N1c3RvbU1lc3NhZ2V9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIGAgOiAnJ31cbiAgICAgICAgXG4gICAgICAgIDxoMj5UcmFuc2FjdGlvbiBEZXRhaWxzPC9oMj5cbiAgICAgICAgPHRhYmxlPlxuICAgICAgICAgIDx0aGVhZD5cbiAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgPHRoPkRhdGU8L3RoPlxuICAgICAgICAgICAgICA8dGg+RGVzY3JpcHRpb248L3RoPlxuICAgICAgICAgICAgICA8dGggc3R5bGU9XCJ0ZXh0LWFsaWduOiByaWdodDtcIj5DaGFyZ2VzPC90aD5cbiAgICAgICAgICAgICAgPHRoIHN0eWxlPVwidGV4dC1hbGlnbjogcmlnaHQ7XCI+Q3JlZGl0czwvdGg+XG4gICAgICAgICAgICAgIDx0aD5Ob3RlczwvdGg+XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICAgIDwvdGhlYWQ+XG4gICAgICAgICAgPHRib2R5PlxuICAgICAgICAgICAgJHt0cmFuc2FjdGlvblJvd3N9XG4gICAgICAgICAgPC90Ym9keT5cbiAgICAgICAgPC90YWJsZT5cbiAgICAgICAgXG4gICAgICAgIDxkaXYgY2xhc3M9XCJzdW1tYXJ5XCI+XG4gICAgICAgICAgPHRhYmxlIHN0eWxlPVwid2lkdGg6IGF1dG87IG1hcmdpbi1sZWZ0OiBhdXRvO1wiPlxuICAgICAgICAgICAgPHRyPlxuICAgICAgICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiA1cHg7XCI+PHN0cm9uZz5Ub3RhbCBDaGFyZ2VzOjwvc3Ryb25nPjwvdGQ+XG4gICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDVweDsgdGV4dC1hbGlnbjogcmlnaHQ7XCI+JCR7dG90YWxDaGFyZ2VzLnRvRml4ZWQoMil9PC90ZD5cbiAgICAgICAgICAgIDwvdHI+XG4gICAgICAgICAgICA8dHI+XG4gICAgICAgICAgICAgIDx0ZCBzdHlsZT1cInBhZGRpbmc6IDVweDtcIj48c3Ryb25nPlRvdGFsIENyZWRpdHM6PC9zdHJvbmc+PC90ZD5cbiAgICAgICAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogNXB4OyB0ZXh0LWFsaWduOiByaWdodDtcIj4kJHt0b3RhbENyZWRpdHMudG9GaXhlZCgyKX08L3RkPlxuICAgICAgICAgICAgPC90cj5cbiAgICAgICAgICAgIDx0cj5cbiAgICAgICAgICAgICAgPHRkIHN0eWxlPVwicGFkZGluZzogMTBweCA1cHg7IGJvcmRlci10b3A6IDJweCBzb2xpZCAjMzMzO1wiPlxuICAgICAgICAgICAgICAgIDxzdHJvbmc+Q3VycmVudCBCYWxhbmNlOjwvc3Ryb25nPlxuICAgICAgICAgICAgICA8L3RkPlxuICAgICAgICAgICAgICA8dGQgc3R5bGU9XCJwYWRkaW5nOiAxMHB4IDVweDsgYm9yZGVyLXRvcDogMnB4IHNvbGlkICMzMzM7IHRleHQtYWxpZ246IHJpZ2h0O1wiPlxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiYmFsYW5jZVwiPlxuICAgICAgICAgICAgICAgICAgJCR7TWF0aC5hYnMoYmFsYW5jZSkudG9GaXhlZCgyKX0gJHtiYWxhbmNlID4gMCA/ICcoT3dlZCknIDogYmFsYW5jZSA8IDAgPyAnKENyZWRpdCknIDogJyhQYWlkIGluIEZ1bGwpJ31cbiAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgIDwvdGQ+XG4gICAgICAgICAgICA8L3RyPlxuICAgICAgICAgIDwvdGFibGU+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICBcbiAgICAgICAgPHAgc3R5bGU9XCJtYXJnaW4tdG9wOiAzMHB4OyBjb2xvcjogIzY2NjsgZm9udC1zaXplOiAxMnB4O1wiPlxuICAgICAgICAgIFRoaXMgaW52b2ljZSB3YXMgZ2VuZXJhdGVkIG9uICR7bmV3IERhdGUoKS50b0xvY2FsZURhdGVTdHJpbmcoKX0uXG4gICAgICAgICAgSWYgeW91IGhhdmUgYW55IHF1ZXN0aW9ucywgcGxlYXNlIGNvbnRhY3QgJHtBRE1JTl9FTUFJTH0uXG4gICAgICAgIDwvcD5cbiAgICAgIDwvZGl2PlxuICAgIDwvYm9keT5cbiAgICA8L2h0bWw+XG4gIGA7XG59XG4iXX0=