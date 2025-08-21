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
var import_uuid = require("uuid");
var dynamoClient = new import_client_dynamodb.DynamoDBClient({ region: process.env.REGION || "us-east-2" });
var docClient = import_lib_dynamodb.DynamoDBDocumentClient.from(dynamoClient);
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
          console.log("No students table configured");
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
          console.log(`Found ${items.length} students`);
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
        console.log("Creating student:", body);
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
          try {
            await docClient.send(new import_lib_dynamodb.PutCommand({
              TableName: process.env.STUDENTS_TABLE,
              Item: student
            }));
            console.log("Student created successfully:", student.studentId);
          } catch (error) {
            console.error("Error creating student:", error);
            return {
              statusCode: 500,
              headers: corsHeaders,
              body: JSON.stringify({ error: "Failed to create student" })
            };
          }
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
          try {
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
          } catch (error) {
            console.error("Error updating student:", error);
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
          console.log("No parents table configured");
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
          console.log(`Found ${result.Items?.length || 0} parents`);
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
        console.log("Creating parent:", body);
        const parent = {
          parentId: (0, import_uuid.v4)(),
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          phone: body.phone,
          studentIds: body.studentIds || [],
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (process.env.PARENTS_TABLE) {
          try {
            await docClient.send(new import_lib_dynamodb.PutCommand({
              TableName: process.env.PARENTS_TABLE,
              Item: parent
            }));
            console.log("Parent created successfully:", parent.parentId);
          } catch (error) {
            console.error("Error creating parent:", error);
            return {
              statusCode: 500,
              headers: corsHeaders,
              body: JSON.stringify({ error: "Failed to create parent" })
            };
          }
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
        console.log("Creating transaction:", body);
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
          createdBy: "admin"
        };
        if (process.env.TRANSACTIONS_TABLE) {
          try {
            await docClient.send(new import_lib_dynamodb.PutCommand({
              TableName: process.env.TRANSACTIONS_TABLE,
              Item: transaction
            }));
            console.log("Transaction created successfully:", transaction.transactionId);
            if (process.env.STUDENTS_TABLE && transaction.studentId) {
              try {
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
                  console.log(`Updated student ${transaction.studentId} balance to ${newBalance}`);
                }
              } catch (error) {
                console.error("Error updating student balance:", error);
              }
            }
          } catch (error) {
            console.error("Error creating transaction:", error);
            return {
              statusCode: 500,
              headers: corsHeaders,
              body: JSON.stringify({ error: "Failed to create transaction" })
            };
          }
        }
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(transaction)
        };
      }
    }
    if (path === "/transactions/bulk" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { choir, gender, description, amount, date, schoolYear, type } = body;
      console.log("Processing bulk charge:", body);
      if (!process.env.STUDENTS_TABLE || !process.env.TRANSACTIONS_TABLE) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Tables not configured" })
        };
      }
      try {
        const studentsResult = await docClient.send(new import_lib_dynamodb.ScanCommand({
          TableName: process.env.STUDENTS_TABLE
        }));
        let students = studentsResult.Items || [];
        students = students.filter((s) => s.schoolYear === schoolYear);
        students = students.filter((s) => s.choir && s.choir.includes(choir));
        if (choir === "Music Warehouse" && gender) {
          students = students.filter((s) => s.gender === gender);
        }
        console.log(`Found ${students.length} students for bulk charge`);
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
            createdBy: "admin"
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
      } catch (error) {
        console.error("Error processing bulk charge:", error);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: "Failed to process bulk charge" })
        };
      }
    }
    if (path === "/invoices/send" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "Invoice would be sent here",
          studentId: body.studentId,
          schoolYear: body.schoolYear
        })
      };
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
//# sourceMappingURL=index.js.map
