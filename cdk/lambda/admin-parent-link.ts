
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { requireAdmin } from './_auth';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try { requireAdmin(event); } catch (e:any) { return e; }
  const body = JSON.parse(event.body || '{}');
  const parentEmail = (body.parentEmail || '').toLowerCase().trim();
  const studentId = (body.studentId || '').trim();
  if (!parentEmail || !studentId) return { statusCode: 400, body: 'parentEmail and studentId required' };

  await ddb.send(new PutItemCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: { S: `PARENT#${parentEmail}` },
      SK: { S: `LINK#${studentId}` },
      GSI1PK: { S: `PARENT#${parentEmail}` },
      GSI1SK: { S: `LINK#${studentId}` },
    }
  }));

  return { statusCode: 200, body: 'ok' };
};
