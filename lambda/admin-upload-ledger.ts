import { S3Event, S3Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import * as XLSX from 'xlsx';

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const DEFAULT_SEASON = process.env.DEFAULT_SEASON || '2025-2026';

const START_ROWS: Record<string, number> = { 'MW Ledger': 76, 'SL Ledger': 74, 'VO Ledger': 46 };
const COLS = { castNumber: 'A', studentName: 'B', fee: 'E', credit: 'F' };
const CHOIR_KEYS: Record<string, string> = { 'MW Ledger': 'MW', 'SL Ledger': 'SL', 'VO Ledger': 'VO' };

async function streamToBuffer(stream: any): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (d: any) => chunks.push(d));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

const put = (item: any) => ddb.send(new PutItemCommand(item));

export const handler: S3Handler = async (event: S3Event) => {
  for (const record of event.Records) {
    const Bucket = record.s3.bucket.name;
    const Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    const obj = await s3.send(new GetObjectCommand({ Bucket, Key }));
    const buf = await streamToBuffer(obj.Body as any);
    const wb = XLSX.read(buf, { type: 'buffer' });

    for (const sheetName of Object.keys(START_ROWS)) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;
      const choir = CHOIR_KEYS[sheetName];
      const startRow = START_ROWS[sheetName];

      let emptyCount = 0;
      for (let r = startRow; r < startRow + 1000; r++) {
        const castCell = ws[`${COLS.castNumber}${r}`];
        const nameCell = ws[`${COLS.studentName}${r}`];
        const feeCell = ws[`${COLS.fee}${r}`];
        const creditCell = ws[`${COLS.credit}${r}`];

        const castNumber = castCell?.v?.toString().trim();
        const studentName = nameCell?.v?.toString().trim();
        const fee = Number(feeCell?.v || 0);
        const credit = Number(creditCell?.v || 0);

        if (!castNumber && !studentName) {
          emptyCount++;
          if (emptyCount > 10) break;
          continue;
        } else {
          emptyCount = 0;
        }

        if (!castNumber) continue;

        const studentId = `CAST${castNumber}`;
        const lineId = `${choir}#CAST${castNumber}`;

        const items = [];
        if (fee) items.push({ type: 'fee', choir, desc: `${choir} Fee`, amount: Math.round(fee * 100) });
        if (credit) items.push({ type: 'credit', choir, desc: `${choir} Credit`, amount: Math.round(credit * 100) });

        for (const it of items) {
          const entryId = `${lineId}#${it.type}`;

          await put({
            TableName: TABLE_NAME,
            Item: {
              PK: { S: `STUDENT#${studentId}` },
              SK: { S: `INVOICE#${DEFAULT_SEASON}` },
              GSI1PK: { S: `PARENT#TEST-PARENT` },  // placeholder link for sandbox
              GSI1SK: { S: `LINK#${studentId}` },
              studentId: { S: studentId },
              studentName: { S: studentName || '' },
              season: { S: DEFAULT_SEASON },
              choir: { S: choir },
              entryId: { S: entryId },
              entryType: { S: it.type },
              desc: { S: it.desc },
              amountCents: { N: String(it.amount) }
            }
          });
        }
      }
    }
  }
};
