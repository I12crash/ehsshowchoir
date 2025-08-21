import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({ region: process.env.REGION || 'us-east-2' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sesClient = new SESClient({ region: process.env.REGION || 'us-east-2' });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'showchoirtreasurer@gmail.com';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

interface Student {
  studentId: string;
  schoolYear: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  choir: string[];
  parentIds: string[];
  balance: number;
  createdAt: string;
  updatedAt: string;
}

interface Parent {
  parentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  studentIds: string[];
  createdAt: string;
}

interface Transaction {
  transactionId: string;
  date: string;
  studentId: string;
  schoolYear: string;
  description: string;
  type: 'charge' | 'credit';
  amount: number;
  notes?: string;
  createdAt: string;
  createdBy: string;
  modifiedAt?: string;
  modifiedBy?: string;
  auditLog?: AuditEntry[];
}

interface AuditEntry {
  timestamp: string;
  user: string;
  action: string;
  changes?: any;
}

export const handler = async (
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> => {
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
        const result = await docClient.send(new ScanCommand({
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
      } catch (error) {
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
          const result = await docClient.send(new ScanCommand({
            TableName: process.env.STUDENTS_TABLE,
          }));
          
          let items = result.Items || [];
          if (schoolYear) {
            items = items.filter((item: any) => item.schoolYear === schoolYear);
          }
          
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(items),
          };
        } catch (error) {
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
        const student: Student = {
          studentId: uuidv4(),
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
          await docClient.send(new PutCommand({
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
          const getResult = await docClient.send(new GetCommand({
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
            
            await docClient.send(new PutCommand({
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
          const result = await docClient.send(new ScanCommand({
            TableName: process.env.PARENTS_TABLE,
          }));
          
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(result.Items || []),
          };
        } catch (error) {
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
        const parent: Parent = {
          parentId: uuidv4(),
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email.toLowerCase(),
          phone: body.phone,
          studentIds: body.studentIds || [],
          createdAt: new Date().toISOString(),
        };

        if (process.env.PARENTS_TABLE) {
          await docClient.send(new PutCommand({
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
          const result = await docClient.send(new ScanCommand({
            TableName: process.env.TRANSACTIONS_TABLE,
          }));
          
          let items = result.Items || [];
          if (schoolYear) {
            items = items.filter((item: any) => item.schoolYear === schoolYear);
          }
          
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(items),
          };
        } catch (error) {
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
        
        const transaction: Transaction = {
          transactionId: uuidv4(),
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
          await docClient.send(new PutCommand({
            TableName: process.env.TRANSACTIONS_TABLE,
            Item: transaction,
          }));
          
          // Update student balance
          if (process.env.STUDENTS_TABLE && transaction.studentId) {
            const studentResult = await docClient.send(new GetCommand({
              TableName: process.env.STUDENTS_TABLE,
              Key: { studentId: transaction.studentId },
            }));
            
            if (studentResult.Item) {
              const currentBalance = studentResult.Item.balance || 0;
              const balanceChange = transaction.type === 'charge' ? transaction.amount : -transaction.amount;
              const newBalance = currentBalance + balanceChange;
              
              await docClient.send(new UpdateCommand({
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
        const getResult = await docClient.send(new GetCommand({
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
        
        const oldTransaction = getResult.Item as Transaction;
        const oldAmount = oldTransaction.amount;
        const oldType = oldTransaction.type;
        
        // Create audit entry
        const auditEntry: AuditEntry = {
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
        const updatedTransaction: Transaction = {
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
        
        await docClient.send(new PutCommand({
          TableName: process.env.TRANSACTIONS_TABLE,
          Item: updatedTransaction,
        }));
        
        // Update student balance
        if (process.env.STUDENTS_TABLE && updatedTransaction.studentId) {
          const studentResult = await docClient.send(new GetCommand({
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
            
            await docClient.send(new UpdateCommand({
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
        const getResult = await docClient.send(new GetCommand({
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
        
        const transaction = getResult.Item as Transaction;
        
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
        await docClient.send(new PutCommand({
          TableName: process.env.TRANSACTIONS_TABLE,
          Item: deletedTransaction,
        }));
        
        // Reverse the balance change
        if (process.env.STUDENTS_TABLE && transaction.studentId) {
          const studentResult = await docClient.send(new GetCommand({
            TableName: process.env.STUDENTS_TABLE,
            Key: { studentId: transaction.studentId },
          }));
          
          if (studentResult.Item) {
            const currentBalance = studentResult.Item.balance || 0;
            const reverseAmount = transaction.type === 'charge' ? -transaction.amount : transaction.amount;
            const newBalance = currentBalance + reverseAmount;
            
            await docClient.send(new UpdateCommand({
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
      
      const studentsResult = await docClient.send(new ScanCommand({
        TableName: process.env.STUDENTS_TABLE,
      }));
      
      let students = studentsResult.Items || [];
      students = students.filter((s: any) => s.schoolYear === schoolYear);
      students = students.filter((s: any) => s.choir && s.choir.includes(choir));
      
      if (choir === 'Music Warehouse' && gender) {
        students = students.filter((s: any) => s.gender === gender);
      }
      
      const transactions = [];
      for (const student of students) {
        const transaction: Transaction = {
          transactionId: uuidv4(),
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
        
        await docClient.send(new PutCommand({
          TableName: process.env.TRANSACTIONS_TABLE!,
          Item: transaction,
        }));
        
        const currentBalance = student.balance || 0;
        const balanceChange = transaction.type === 'charge' ? amount : -amount;
        const newBalance = currentBalance + balanceChange;
        
        await docClient.send(new UpdateCommand({
          TableName: process.env.STUDENTS_TABLE!,
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
      const studentResult = await docClient.send(new GetCommand({
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
      
      const student = studentResult.Item as Student;
      
      // Get parent emails
      const parentEmails: string[] = [];
      if (student.parentIds && student.parentIds.length > 0) {
        for (const parentId of student.parentIds) {
          const parentResult = await docClient.send(new GetCommand({
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
      const transactionsResult = await docClient.send(new ScanCommand({
        TableName: process.env.TRANSACTIONS_TABLE,
        FilterExpression: 'studentId = :sid AND schoolYear = :sy AND (attribute_not_exists(deleted) OR deleted = :false)',
        ExpressionAttributeValues: {
          ':sid': studentId,
          ':sy': schoolYear,
          ':false': false,
        },
      }));
      
      const transactions = (transactionsResult.Items || []).sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
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
        await sesClient.send(new SendEmailCommand(emailParams));
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
      } catch (error) {
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

  } catch (error) {
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

function generateInvoiceHTML(student: Student, transactions: any[], schoolYear: string, customMessage?: string): string {
  let totalCharges = 0;
  let totalCredits = 0;
  
  const transactionRows = transactions.map(t => {
    if (t.type === 'charge') {
      totalCharges += t.amount;
    } else {
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
