
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { requireAdmin } from './_auth';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try { requireAdmin(event); } catch (e:any) { return e; }

  const sid = decodeURIComponent(event.pathParameters?.studentId || '');
  if (!sid) return { statusCode: 400, body: 'studentId required' };

  await ddb.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: { PK: { S: `STUDENT#${sid}` }, SK: { S: 'PROFILE' } },
    UpdateExpression: "SET #a = :false",
    ExpressionAttributeNames: { "#a": "active" },
    ExpressionAttributeValues: { ":false": { BOOL: false } }
  }));

  return { statusCode: 200, body: 'ok' };
};
