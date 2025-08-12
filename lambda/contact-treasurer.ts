import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const body = JSON.parse(event.body || '{}');
  const { fromEmail, message, studentId } = body;
  if (!fromEmail || !message) return { statusCode: 400, body: 'fromEmail and message are required' };

  const toAddress = process.env.TREASURER_EMAIL || 'treasurer@example.com';
  const subject = `Invoice question for ${studentId || 'Unknown Student'}`;
  const html = `<p>From: ${fromEmail}</p><p>Student: ${studentId || 'N/A'}</p><p>Message:</p><pre>${message}</pre>`;

  await ses.send(new SendEmailCommand({
    FromEmailAddress: toAddress,
    Destination: { ToAddresses: [toAddress] },
    Content: { Simple: { Subject: { Data: subject }, Body: { Html: { Data: html } } } }
  }));

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
