# Show Choir Billing – Serverless Starter (AWS + Cognito + DynamoDB + SES)
Minimal, low-cost starter for family invoice viewing, contact form, and admin XLSM ingest.
**Note:** Square payments are disabled in this starter (can be added later).

## What’s included
- **CDK (TypeScript)**: Cognito (Hosted UI), API Gateway (HTTP API), Lambdas, DynamoDB, S3 (site + uploads), CloudFront, SES perms.
- **Lambdas (Node)**:
  - `get-invoice` – returns invoices for the logged-in parent.
  - `contact-treasurer` – sends an email via SES.
  - `admin-upload-ledger` – S3-triggered ETL to parse `.xlsm` ledgers (MW/SL/VO) and write/update invoices in DynamoDB.
- **Frontend (Vite + React)**: Login buttons (Cognito Hosted UI), Invoice page. Payment UI omitted for now.

## Repo layout
```
cdk/                # AWS CDK app (infra)
lambda/             # Lambda handlers (Node + TypeScript)
frontend/           # React app (Vite)
```

## Deploy (sandbox/test) — explicit commands
If you see `Specify an environment name like 'aws://123456789012/us-east-1', or run in a directory with 'cdk.json'`:
- Run from the `cdk/` directory and ensure `cdk/cdk.json` exists (this repo includes it).

From the `cdk/` directory:
```bash
cd cdk
npm i
npm run build
npx cdk bootstrap
npx cdk deploy
```

If your AWS CLI uses a named profile:
```bash
npx cdk bootstrap --profile YOUR_PROFILE
npx cdk deploy --profile YOUR_PROFILE
```

To be explicit about account/region:
```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1
npx cdk bootstrap aws://$ACCOUNT_ID/$REGION
npx cdk deploy
```

### If you saw `ValidationError: Cannot find entry file at lambda/...`
This starter keeps Lambda sources at the repo root `lambda/` while the CDK app lives in `cdk/`. 
The stack points to `../lambda/...` so run CDK from inside `cdk/` after `npm run build`.

### Note about CloudFront origin deprecation
This starter uses `S3BucketOrigin` (CDK's newer class) to avoid deprecation warnings.

