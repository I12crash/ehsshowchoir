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
var import_client_s3 = require("@aws-sdk/client-s3");
var s3Client = new import_client_s3.S3Client({ region: process.env.REGION });
var handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));
  const path = event.rawPath;
  const method = event.requestContext.http.method;
  if (path === "/health" && method === "GET") {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        status: "healthy",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        region: process.env.REGION
      })
    };
  }
  if (path === "/uploads" && method === "GET") {
    try {
      const command = new import_client_s3.ListObjectsV2Command({
        Bucket: process.env.UPLOADS_BUCKET,
        MaxKeys: 100
      });
      const response = await s3Client.send(command);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          files: response.Contents || []
        })
      };
    } catch (error) {
      console.error("Error listing uploads:", error);
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          error: "Failed to list uploads"
        })
      };
    }
  }
  return {
    statusCode: 404,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({
      message: "Not Found",
      path,
      method
    })
  };
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
