
import { APIGatewayProxyEventV2 } from 'aws-lambda';

export function getEmailFromEvent(event: any): string | undefined {
  const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer;
  return claims?.email || claims?.claim?.email || undefined;
}

export function requireAdmin(event: any) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const ro = (process.env.READONLY_EMAILS || '').toLowerCase();
  const email = (getEmailFromEvent(event) || '').toLowerCase();
  if (email === adminEmail) return true;
  const isReadOnly = ro.split(',').map(s=>s.trim()).filter(Boolean).includes(email);
  if (isReadOnly) {
    const err: any = { statusCode: 403, body: 'read-only users cannot modify' };
    throw err;
  }
  const err: any = { statusCode: 401, body: 'unauthorized' };
  throw err;
}

export function allowReadOnly(event: any) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const ro = (process.env.READONLY_EMAILS || '').toLowerCase();
  const email = (getEmailFromEvent(event) || '').toLowerCase();
  if (email === adminEmail) return true;
  const isReadOnly = ro.split(',').map(s=>s.trim()).filter(Boolean).includes(email);
  if (isReadOnly) return true;
  const err: any = { statusCode: 401, body: 'unauthorized' };
  throw err;
}
