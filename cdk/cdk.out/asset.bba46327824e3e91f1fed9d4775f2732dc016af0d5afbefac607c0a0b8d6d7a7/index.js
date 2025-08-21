"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// cdk/lambda/api.ts
var api_exports = {};
__export(api_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(api_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_ses = require("@aws-sdk/client-ses");
var import_uuid = require("uuid");
var dynamoClient = new import_client_dynamodb.DynamoDBClient({ region: process.env.REGION || "us-east-2" });
var docClient = import_lib_dynamodb.DynamoDBDocumentClient.from(dynamoClient);
var sesClient = new import_client_ses.SESClient({ region: process.env.REGION || "us-east-2" });
var ADMIN_EMAIL = process.env.ADMIN_EMAIL || "showchoirtreasurer@gmail.com";
var corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
};
var handler = async (event, context) => {
  console.log("Event:", JSON.stringify(event, null, 2));
  const path = event.rawPath;
  const method = event.requestContext.http.method;
  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ""
    };
  }
  try {
    if (path === "/health" && method === "GET") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          status: "healthy",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          region: process.env.REGION || "us-east-2",
          tables: {
            students: process.env.STUDENTS_TABLE,
            parents: process.env.PARENTS_TABLE,
            transactions: process.env.TRANSACTIONS_TABLE
          }
        })
      };
    }
    if (path === "/auth/check-parent" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const email = body.email?.toLowerCase();
      if (!email || !process.env.PARENTS_TABLE) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            isRegistered: false,
            message: "Email not provided or system not configured"
          })
        };
      }
      try {
        const result = await docClient.send(new import_lib_dynamodb.ScanCommand({
          TableName: process.env.PARENTS_TABLE,
          FilterExpression: "email = :email",
          ExpressionAttributeValues: {
            ":email": email
          }
        }));
        const isRegistered = result.Items && result.Items.length > 0;
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            isRegistered,
            message: isRegistered ? "Email is registered as a parent" : "Email is not registered in the system. Please contact the administrator."
          })
        };
      } catch (error) {
        console.error("Error checking parent email:", error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            isRegistered: false,
            message: "Error checking registration status"
          })
        };
      }
    }
    if (path === "/admin/check" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const userEmail = body.email || "";
      const isAdmin = userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          isAdmin,
          userEmail,
          adminEmail: ADMIN_EMAIL
        })
      };
    }
    if (path === "/students" || path.startsWith("/students/")) {
      if (method === "GET" && path === "/students") {
        const params = event.queryStringParameters;
        const schoolYear = params?.schoolYear;
        if (!process.env.STUDENTS_TABLE) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify([])
          };
        }
        try {
          const result = await docClient.send(new import_lib_dynamodb.ScanCommand({
            TableName: process.env.STUDENTS_TABLE
          }));
          let items = result.Items || [];
          if (schoolYear) {
            items = items.filter((item) => item.schoolYear === schoolYear);
          }
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(items)
          };
        } catch (error) {
          console.error("Error fetching students:", error);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify([])
          };
        }
      }
      if (method === "POST" && path === "/students") {
        const body = JSON.parse(event.body || "{}");
        const student = {
          studentId: (0, import_uuid.v4)(),
          schoolYear: body.schoolYear || "2024-2025",
          firstName: body.firstName,
          lastName: body.lastName,
          gender: body.gender || "male",
          choir: body.choir || [],
          parentIds: body.parentIds || [],
          balance: 0,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (process.env.STUDENTS_TABLE) {
          await docClient.send(new import_lib_dynamodb.PutCommand({
            TableName: process.env.STUDENTS_TABLE,
            Item: student
          }));
        }
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(student)
        };
      }
      if (method === "PUT" && path.startsWith("/students/")) {
        const studentId = path.split("/")[2];
        const body = JSON.parse(event.body || "{}");
        if (process.env.STUDENTS_TABLE) {
          const getResult = await docClient.send(new import_lib_dynamodb.GetCommand({
            TableName: process.env.STUDENTS_TABLE,
            Key: { studentId }
          }));
          if (getResult.Item) {
            const updatedStudent = {
              ...getResult.Item,
              ...body,
              studentId,
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            };
            await docClient.send(new import_lib_dynamodb.PutCommand({
              TableName: process.env.STUDENTS_TABLE,
              Item: updatedStudent
            }));
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify(updatedStudent)
            };
          }
        }
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Student not found" })
        };
      }
    }
    if (path === "/parents" || path.startsWith("/parents/")) {
      if (method === "GET" && path === "/parents") {
        if (!process.env.PARENTS_TABLE) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify([])
          };
        }
        try {
          const result = await docClient.send(new import_lib_dynamodb.ScanCommand({
            TableName: process.env.PARENTS_TABLE
          }));
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(result.Items || [])
          };
        } catch (error) {
          console.error("Error fetching parents:", error);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify([])
          };
        }
      }
      if (method === "POST" && path === "/parents") {
        const body = JSON.parse(event.body || "{}");
        const parent = {
          parentId: (0, import_uuid.v4)(),
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email.toLowerCase(),
          phone: body.phone,
          studentIds: body.studentIds || [],
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (process.env.PARENTS_TABLE) {
          await docClient.send(new import_lib_dynamodb.PutCommand({
            TableName: process.env.PARENTS_TABLE,
            Item: parent
          }));
        }
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(parent)
        };
      }
    }
    if (path === "/transactions" || path.startsWith("/transactions/")) {
      if (method === "GET" && path === "/transactions") {
        const params = event.queryStringParameters;
        const schoolYear = params?.schoolYear;
        if (!process.env.TRANSACTIONS_TABLE) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify([])
          };
        }
        try {
          const result = await docClient.send(new import_lib_dynamodb.ScanCommand({
            TableName: process.env.TRANSACTIONS_TABLE
          }));
          let items = result.Items || [];
          if (schoolYear) {
            items = items.filter((item) => item.schoolYear === schoolYear);
          }
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(items)
          };
        } catch (error) {
          console.error("Error fetching transactions:", error);
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify([])
          };
        }
      }
      if (method === "POST" && path === "/transactions") {
        const body = JSON.parse(event.body || "{}");
        const userEmail = body.userEmail || "admin";
        const transaction = {
          transactionId: (0, import_uuid.v4)(),
          date: body.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          studentId: body.studentId,
          schoolYear: body.schoolYear,
          description: body.description,
          type: body.type,
          amount: body.amount,
          notes: body.notes,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdBy: userEmail,
          auditLog: [{
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            user: userEmail,
            action: "Created transaction"
          }]
        };
        if (process.env.TRANSACTIONS_TABLE) {
          await docClient.send(new import_lib_dynamodb.PutCommand({
            TableName: process.env.TRANSACTIONS_TABLE,
            Item: transaction
          }));
          if (process.env.STUDENTS_TABLE && transaction.studentId) {
            const studentResult = await docClient.send(new import_lib_dynamodb.GetCommand({
              TableName: process.env.STUDENTS_TABLE,
              Key: { studentId: transaction.studentId }
            }));
            if (studentResult.Item) {
              const currentBalance = studentResult.Item.balance || 0;
              const balanceChange = transaction.type === "charge" ? transaction.amount : -transaction.amount;
              const newBalance = currentBalance + balanceChange;
              await docClient.send(new import_lib_dynamodb.UpdateCommand({
                TableName: process.env.STUDENTS_TABLE,
                Key: { studentId: transaction.studentId },
                UpdateExpression: "SET balance = :balance, updatedAt = :now",
                ExpressionAttributeValues: {
                  ":balance": newBalance,
                  ":now": (/* @__PURE__ */ new Date()).toISOString()
                }
              }));
            }
          }
        }
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(transaction)
        };
      }
      if (method === "PUT" && path.startsWith("/transactions/")) {
        const transactionId = path.split("/")[2];
        const body = JSON.parse(event.body || "{}");
        const userEmail = body.userEmail || "admin";
        if (!process.env.TRANSACTIONS_TABLE) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Transactions table not configured" })
          };
        }
        const getResult = await docClient.send(new import_lib_dynamodb.GetCommand({
          TableName: process.env.TRANSACTIONS_TABLE,
          Key: { transactionId }
        }));
        if (!getResult.Item) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Transaction not found" })
          };
        }
        const oldTransaction = getResult.Item;
        const oldAmount = oldTransaction.amount;
        const oldType = oldTransaction.type;
        const auditEntry = {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          user: userEmail,
          action: "Modified transaction",
          changes: {
            old: {
              amount: oldAmount,
              type: oldType,
              description: oldTransaction.description,
              date: oldTransaction.date,
              notes: oldTransaction.notes
            },
            new: {
              amount: body.amount,
              type: body.type,
              description: body.description,
              date: body.date,
              notes: body.notes
            }
          }
        };
        const auditLog = [...oldTransaction.auditLog || [], auditEntry];
        const updatedTransaction = {
          ...oldTransaction,
          date: body.date || oldTransaction.date,
          description: body.description || oldTransaction.description,
          type: body.type || oldTransaction.type,
          amount: body.amount !== void 0 ? body.amount : oldTransaction.amount,
          notes: body.notes,
          modifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
          modifiedBy: userEmail,
          auditLog
        };
        await docClient.send(new import_lib_dynamodb.PutCommand({
          TableName: process.env.TRANSACTIONS_TABLE,
          Item: updatedTransaction
        }));
        if (process.env.STUDENTS_TABLE && updatedTransaction.studentId) {
          const studentResult = await docClient.send(new import_lib_dynamodb.GetCommand({
            TableName: process.env.STUDENTS_TABLE,
            Key: { studentId: updatedTransaction.studentId }
          }));
          if (studentResult.Item) {
            const currentBalance = studentResult.Item.balance || 0;
            const reverseOld = oldType === "charge" ? -oldAmount : oldAmount;
            const applyNew = updatedTransaction.type === "charge" ? updatedTransaction.amount : -updatedTransaction.amount;
            const newBalance = currentBalance + reverseOld + applyNew;
            await docClient.send(new import_lib_dynamodb.UpdateCommand({
              TableName: process.env.STUDENTS_TABLE,
              Key: { studentId: updatedTransaction.studentId },
              UpdateExpression: "SET balance = :balance, updatedAt = :now",
              ExpressionAttributeValues: {
                ":balance": newBalance,
                ":now": (/* @__PURE__ */ new Date()).toISOString()
              }
            }));
          }
        }
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(updatedTransaction)
        };
      }
      if (method === "DELETE" && path.startsWith("/transactions/")) {
        const transactionId = path.split("/")[2];
        const params = event.queryStringParameters;
        const userEmail = params?.userEmail || "admin";
        if (!process.env.TRANSACTIONS_TABLE) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Transactions table not configured" })
          };
        }
        const getResult = await docClient.send(new import_lib_dynamodb.GetCommand({
          TableName: process.env.TRANSACTIONS_TABLE,
          Key: { transactionId }
        }));
        if (!getResult.Item) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Transaction not found" })
          };
        }
        const transaction = getResult.Item;
        const deletedTransaction = {
          ...transaction,
          deleted: true,
          deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
          deletedBy: userEmail,
          auditLog: [
            ...transaction.auditLog || [],
            {
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              user: userEmail,
              action: "Deleted transaction"
            }
          ]
        };
        await docClient.send(new import_lib_dynamodb.PutCommand({
          TableName: process.env.TRANSACTIONS_TABLE,
          Item: deletedTransaction
        }));
        if (process.env.STUDENTS_TABLE && transaction.studentId) {
          const studentResult = await docClient.send(new import_lib_dynamodb.GetCommand({
            TableName: process.env.STUDENTS_TABLE,
            Key: { studentId: transaction.studentId }
          }));
          if (studentResult.Item) {
            const currentBalance = studentResult.Item.balance || 0;
            const reverseAmount = transaction.type === "charge" ? -transaction.amount : transaction.amount;
            const newBalance = currentBalance + reverseAmount;
            await docClient.send(new import_lib_dynamodb.UpdateCommand({
              TableName: process.env.STUDENTS_TABLE,
              Key: { studentId: transaction.studentId },
              UpdateExpression: "SET balance = :balance, updatedAt = :now",
              ExpressionAttributeValues: {
                ":balance": newBalance,
                ":now": (/* @__PURE__ */ new Date()).toISOString()
              }
            }));
          }
        }
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Transaction deleted", transaction: deletedTransaction })
        };
      }
    }
    if (path === "/transactions/bulk" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { choir, gender, description, amount, date, schoolYear, type, userEmail } = body;
      if (!process.env.STUDENTS_TABLE || !process.env.TRANSACTIONS_TABLE) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Tables not configured" })
        };
      }
      const studentsResult = await docClient.send(new import_lib_dynamodb.ScanCommand({
        TableName: process.env.STUDENTS_TABLE
      }));
      let students = studentsResult.Items || [];
      students = students.filter((s) => s.schoolYear === schoolYear);
      students = students.filter((s) => s.choir && s.choir.includes(choir));
      if (choir === "Music Warehouse" && gender) {
        students = students.filter((s) => s.gender === gender);
      }
      const transactions = [];
      for (const student of students) {
        const transaction = {
          transactionId: (0, import_uuid.v4)(),
          date: date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
          studentId: student.studentId,
          schoolYear,
          description,
          type: type || "charge",
          amount,
          notes: `Bulk ${type || "charge"} for ${choir}${gender ? ` (${gender})` : ""}`,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdBy: userEmail || "admin",
          auditLog: [{
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            user: userEmail || "admin",
            action: `Created bulk ${type || "charge"}`
          }]
        };
        await docClient.send(new import_lib_dynamodb.PutCommand({
          TableName: process.env.TRANSACTIONS_TABLE,
          Item: transaction
        }));
        const currentBalance = student.balance || 0;
        const balanceChange = transaction.type === "charge" ? amount : -amount;
        const newBalance = currentBalance + balanceChange;
        await docClient.send(new import_lib_dynamodb.UpdateCommand({
          TableName: process.env.STUDENTS_TABLE,
          Key: { studentId: student.studentId },
          UpdateExpression: "SET balance = :balance, updatedAt = :now",
          ExpressionAttributeValues: {
            ":balance": newBalance,
            ":now": (/* @__PURE__ */ new Date()).toISOString()
          }
        }));
        transactions.push(transaction);
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: `Bulk ${type || "charge"} applied to ${transactions.length} students`,
          transactions
        })
      };
    }
    if (path === "/invoices/send" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { studentId, schoolYear, subject, emailBody } = body;
      if (!process.env.STUDENTS_TABLE || !process.env.PARENTS_TABLE || !process.env.TRANSACTIONS_TABLE) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Tables not configured" })
        };
      }
      const studentResult = await docClient.send(new import_lib_dynamodb.GetCommand({
        TableName: process.env.STUDENTS_TABLE,
        Key: { studentId }
      }));
      if (!studentResult.Item) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Student not found" })
        };
      }
      const student = studentResult.Item;
      const parentEmails = [];
      if (student.parentIds && student.parentIds.length > 0) {
        for (const parentId of student.parentIds) {
          const parentResult = await docClient.send(new import_lib_dynamodb.GetCommand({
            TableName: process.env.PARENTS_TABLE,
            Key: { parentId }
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
            error: "No parent emails found",
            message: "Please link parents to this student first"
          })
        };
      }
      const transactionsResult = await docClient.send(new import_lib_dynamodb.ScanCommand({
        TableName: process.env.TRANSACTIONS_TABLE,
        FilterExpression: "studentId = :sid AND schoolYear = :sy AND (attribute_not_exists(deleted) OR deleted = :false)",
        ExpressionAttributeValues: {
          ":sid": studentId,
          ":sy": schoolYear,
          ":false": false
        }
      }));
      const transactions = (transactionsResult.Items || []).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const invoiceHtml = generateInvoiceHTML(student, transactions, schoolYear, emailBody);
      const emailParams = {
        Source: ADMIN_EMAIL,
        Destination: {
          ToAddresses: parentEmails
        },
        Message: {
          Subject: {
            Data: subject || `Show Choir Invoice - ${student.firstName} ${student.lastName} (${schoolYear})`
          },
          Body: {
            Html: {
              Data: invoiceHtml
            }
          }
        }
      };
      try {
        await sesClient.send(new import_client_ses.SendEmailCommand(emailParams));
        console.log("Invoice email sent successfully to:", parentEmails);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            message: `Invoice sent to ${parentEmails.length} parent email(s)`,
            recipients: parentEmails
          })
        };
      } catch (error) {
        console.error("Error sending email:", error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({
            success: false,
            error: "Failed to send email",
            details: error instanceof Error ? error.message : "Unknown error",
            note: "Make sure email addresses are verified in SES"
          })
        };
      }
    }
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Not Found",
        path,
        method
      })
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error"
      })
    };
  }
};
function generateInvoiceHTML(student, transactions, schoolYear, customMessage) {
  let totalCharges = 0;
  let totalCredits = 0;
  const transactionRows = transactions.map((t) => {
    if (t.type === "charge") {
      totalCharges += t.amount;
    } else {
      totalCredits += t.amount;
    }
    return `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${t.date}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${t.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">
          ${t.type === "charge" ? `$${t.amount.toFixed(2)}` : ""}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">
          ${t.type === "credit" ? `$${t.amount.toFixed(2)}` : ""}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${t.notes || ""}</td>
      </tr>
    `;
  }).join("");
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
          color: ${balance > 0 ? "#e74c3c" : "#27ae60"};
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
        <p><strong>Choir(s):</strong> ${student.choir.join(", ")}</p>
        
        ${customMessage ? `
          <div class="custom-message">
            ${customMessage}
          </div>
        ` : ""}
        
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
                  $${Math.abs(balance).toFixed(2)} ${balance > 0 ? "(Owed)" : balance < 0 ? "(Credit)" : "(Paid in Full)"}
                </span>
              </td>
            </tr>
          </table>
        </div>
        
        <p style="margin-top: 30px; color: #666; font-size: 12px;">
          This invoice was generated on ${(/* @__PURE__ */ new Date()).toLocaleDateString()}.
          If you have any questions, please contact ${ADMIN_EMAIL}.
        </p>
      </div>
    </body>
    </html>
  `;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=index.js.map
