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
          schoolYear: body.schoolYear,
          firstName: body.firstName,
          lastName: body.lastName,
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
              // Ensure ID doesn't change
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
          email: body.email,
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
          await docClient.send(new import_lib_dynamodb.PutCommand({
            TableName: process.env.TRANSACTIONS_TABLE,
            Item: transaction
          }));
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
              }
            } catch (error) {
              console.error("Error updating student balance:", error);
            }
          }
        }
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify(transaction)
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
