
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { allowReadOnly } from './_auth';

const ddb = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME!;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try { allowReadOnly(event); } catch (e:any) { return e; }

  const outFmt = (event.queryStringParameters || {})['format'];

  const res = await ddb.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'TypeIndex',
    KeyConditionExpression: 'TYPE = :t',
    ExpressionAttributeValues: { ':t': { S: 'PROFILE' } }
  }));

  const students = (res.Items || []).map(unmarshall).map((x:any) => {
    const cast = (x.studentId || '').split('CAST')[1] || '';
    return {
      studentId: x.studentId, studentName: x.studentName, choir: x.choir,
      gender: x.gender, grade: x.grade, active: x.active !== false, castNumber: cast
    };
  });

  if (outFmt === 'csv') {
    const header = "student_id,student_name,choir,gender,grade,cast_number,active\n";
    const lines = students.map((x:any) =>
      `${x.studentId},${(x.studentName||'').replace(/,/g,' ')},${x.choir||''},${x.gender||''},${x.grade ?? ''},${x.castNumber||''},${x.active}`
    ).join("\n");
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/csv' },
      body: header + lines + "\n"
    };
  }

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ students })
  };
};
