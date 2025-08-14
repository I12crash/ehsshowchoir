
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, QueryCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { requireAdmin } from './_auth';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

function cents(x:number){ return Math.round(Number(x) * 100); }

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try { requireAdmin(event); } catch (e:any) { return e; }

  const body = JSON.parse(event.body || '{}');
  const { choir, gender, amount, season, category, description, date } = body;
  if (!choir || !amount) return { statusCode: 400, body: 'choir and amount required' };

  const res = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'TypeIndex',
    KeyConditionExpression: 'TYPE = :t',
    ExpressionAttributeValues: { ':t': { S: 'PROFILE' } }
  }));
  const all = (res.Items || []).map(unmarshall);
  let students = all.filter((x:any) => (x.choir === choir) && (x.active !== false));
  if (choir === 'MW' && (gender === 'M' || gender === 'F')) {
    students = students.filter((x:any)=> x.gender === gender);
  }

  let count = 0;
  for (const s of students) {
    const sid = s.studentId;
    const ts = Date.now();
    const key = `TXN#${season || 'GEN'}#${ts}#${Math.random().toString(36).slice(2,8)}`;
    await ddb.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: { S: `STUDENT#${sid}` },
        SK: { S: key },
        type: { S: 'fee' },
        amountCents: { N: String(cents(Number(amount))) },
        date: { S: date || new Date().toISOString().slice(0,10) },
        season: { S: season || 'GEN' },
        category: { S: category || '' },
        description: { S: description || '' }
      }
    }));
    count++;
  }

  return { statusCode: 200, headers: {'content-type':'application/json'}, body: JSON.stringify({ ok: true, count }) };
};
