import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const res = await ddb.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: "begins_with(#sk, :inv)",
    ExpressionAttributeNames: { "#sk": "SK" },
    ExpressionAttributeValues: { ":inv": { S: "INVOICE#" } },
    ProjectionExpression: "studentId, studentName, choir"
  }));

  const items = (res.Items || []).map(i => unmarshall(i));
  items.sort((a,b) => (a.studentName||'').localeCompare(b.studentName||''));

  const format = event.queryStringParameters?.format;
  if (format === 'csv') {
    const header = "student_id,student_name,choir\n";
    const lines = items.map((x: any) => `${x.studentId || ''},${(x.studentName||'').replace(/,/g,' ')},${x.choir || ''}`).join("\n");
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=students.csv" },
      body: header + lines
    };
  }

  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ students: items }) };
};
