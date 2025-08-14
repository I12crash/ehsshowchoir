
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { requireAdmin } from './_auth';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try { requireAdmin(event); } catch (e: any) { return e; }

  const body = JSON.parse(event.body || '{}');
  const studentIdInput = (body.studentId ? String(body.studentId) : '').trim();
  const choir = (body.choir || '').toUpperCase(); // MW/SL/VO
  const castNumber = body.castNumber !== undefined ? String(body.castNumber).trim() : '';
  const studentName = body.studentName !== undefined ? String(body.studentName).trim() : undefined;
  const gender = body.gender !== undefined ? String(body.gender).toUpperCase() : undefined; // M/F/''
  const grade = body.grade !== undefined ? Number(body.grade) : undefined; // 9-12
  const active = body.active === undefined ? undefined : !!body.active;

  if (studentIdInput) {
    const sid = studentIdInput;
    const sets: string[] = [];
    const names: Record<string,string> = {};
    const values: Record<string, any> = {};

    if (studentName !== undefined) { sets.push("#n = :n"); names["#n"] = "studentName"; values[":n"] = { S: studentName }; }
    if (gender !== undefined) { sets.push("#g = :g"); names["#g"] = "gender"; values[":g"] = { S: gender }; }
    if (grade !== undefined) { sets.push("#gr = :gr"); names["#gr"] = "grade"; values[":gr"] = { N: String(grade) }; }
    if (active !== undefined) { sets.push("#a = :a"); names["#a"] = "active"; values[":a"] = { BOOL: active }; }
    if (choir) { sets.push("#c = :c"); names["#c"] = "choir"; values[":c"] = { S: choir }; }

    if (sets.length === 0) return { statusCode: 400, body: 'no updatable fields provided' };

    await ddb.send(new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { PK: { S: `STUDENT#${sid}` }, SK: { S: 'PROFILE' } },
      UpdateExpression: "SET " + sets.join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values
    }));

    return { statusCode: 200, body: JSON.stringify({ ok: true, studentId: sid }) };
  }

  if (!choir || !castNumber || !studentName) {
    return { statusCode: 400, body: 'Provide either studentId (for updates) OR choir, castNumber, studentName (for create/upsert)' };
  }
  const studentId = `${choir}-CAST${castNumber}`;

  await ddb.send(new PutItemCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: { S: `STUDENT#${studentId}` },
      SK: { S: 'PROFILE' },
      TYPE: { S: 'PROFILE' },
      studentId: { S: studentId },
      studentName: { S: studentName },
      choir: { S: choir },
      ...(gender !== undefined ? { gender: { S: gender } } : {} as any),
      ...(grade !== undefined ? { grade: { N: String(grade) } } : {} as any),
      active: { BOOL: active === undefined ? true : active },
    }
  }));

  return { statusCode: 200, body: JSON.stringify({ ok: true, studentId }) };
};
