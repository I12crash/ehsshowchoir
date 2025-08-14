
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const ses = new SESv2Client({});
const FROM = 'showchoirtreasurer@gmail.com'; // must be verified in SES

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const body = JSON.parse(event.body || '{}');
  const { studentId, message, from } = body;
  if (!message || !from) return { statusCode: 400, body: 'from and message required' };

  await ses.send(new SendEmailCommand({
    FromEmailAddress: FROM,
    Destination: { ToAddresses: [FROM] },
    Content: {
      Simple: {
        Subject: { Data: `Parent contact: ${studentId || 'general'}` },
        Body: { Text: { Data: `From: ${from}\nStudent: ${studentId || ''}\n\n${message}` } }
      }
    }
  }));

  return { statusCode: 200, body: 'sent' };
};
