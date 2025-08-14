
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, QueryCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

function sumTxns(txns: any[]) {
  let feeCents = 0, creditCents = 0;
  for (const t of txns) {
    if (t.type === 'fee') feeCents += t.amountCents || 0;
    else if (t.type === 'credit') creditCents += t.amountCents || 0;
  }
  return { feeCents, creditCents, balanceCents: feeCents - creditCents };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const qs = event.queryStringParameters || {};
  const studentId = qs['studentId'];
  const parentEmail = (qs['parentEmail'] || '').toLowerCase();

  let studentIds: string[] = [];
  if (studentId) {
    studentIds = [studentId];
  } else if (parentEmail) {
    // find links by email
    const linkRes = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': { S: `PARENT#${parentEmail}` } }
    }));
    const links = (linkRes.Items || []).map(unmarshall);
    studentIds = links.map((x:any)=> (x.GSI1SK || '').replace('LINK#','')).filter(Boolean);
  } else {
    return { statusCode: 400, body: 'provide studentId or parentEmail' };
  }

  const invoices: any[] = [];
  for (const sid of studentIds) {
    // query TXNs for sid
    const txnRes = await ddb.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :s)',
      ExpressionAttributeValues: { ':pk': { S: `STUDENT#${sid}` }, ':s': { S: 'TXN#' } }
    }));
    const txns = (txnRes.Items || []).map(unmarshall);
    const totals = sumTxns(txns);

    // get profile
    const profRes = await ddb.send(new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { PK: { S: `STUDENT#${sid}` }, SK: { S: 'PROFILE' } }
    }));
    const profile = profRes.Item ? unmarshall(profRes.Item) : { studentId: sid };

    invoices.push({ studentId: sid, profile, txns, totals });
  }

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ invoices })
  };
};
