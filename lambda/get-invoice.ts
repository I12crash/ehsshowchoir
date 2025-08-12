import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;
const DEFAULT_SEASON = process.env.DEFAULT_SEASON || '2025-2026';

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const claims = (event.requestContext?.authorizer as any)?.jwt?.claims || {};
  const parentSub = claims?.sub || event.queryStringParameters?.parentSub || 'TEST-PARENT';

  const links = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :p and begins_with(GSI1SK, :l)',
    ExpressionAttributeValues: { ':p': { S: `PARENT#${parentSub}` }, ':l': { S: 'LINK#' } },
  }));
  const studentIds = (links.Items || []).map(i => unmarshall(i).studentId);

  const season = (event.queryStringParameters?.season) || DEFAULT_SEASON;
  const invoices: any[] = [];
  for (const sid of studentIds) {
    const res = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk and SK = :sk',
      ExpressionAttributeValues: { ':pk': { S: `STUDENT#${sid}` }, ':sk': { S: `INVOICE#${season}` } },
    }));
    const item = res.Items?.[0] ? unmarshall(res.Items[0]) : null;
    if (item) invoices.push(item);
  }

  return { statusCode: 200, body: JSON.stringify({ invoices, season }) };
};
