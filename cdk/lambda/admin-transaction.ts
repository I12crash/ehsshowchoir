
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { requireAdmin } from './_auth';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

function cents(x:number){ return Math.round(Number(x) * 100); }

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try { requireAdmin(event); } catch (e:any) { return e; }

  const body = JSON.parse(event.body || '{}');
  const { studentId, type, amount, date, season, category, description } = body;
  if(!studentId || !type || !amount) return { statusCode: 400, body: 'studentId, type, amount required' };

  const ts = Date.now();
  const key = `TXN#${season || 'GEN'}#${ts}#${Math.random().toString(36).slice(2,8)}`;

  await ddb.send(new PutItemCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: { S: `STUDENT#${studentId}` },
      SK: { S: key },
      type: { S: type },
      amountCents: { N: String(cents(Number(amount))) },
      date: { S: date || new Date().toISOString().slice(0,10) },
      season: { S: season || 'GEN' },
      category: { S: category || '' },
      description: { S: description || '' }
    }
  }));

  return { statusCode: 200, body: 'ok' };
};
