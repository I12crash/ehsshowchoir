# Show Choir Billing – Serverless Starter (AWS + Cognito + DynamoDB + SES)
Minimal, low-cost starter for family invoice viewing, contact form, and admin XLSM ingest.
**Note:** Square payments are disabled in this starter (can be added later).

## What’s included
- **CDK (TypeScript)**: Cognito (Hosted UI), API Gateway (HTTP API), Lambdas, DynamoDB, S3 (site + uploads), CloudFront, SES setup placeholders.
- **Lambdas (Node)**:
  - `get-invoice` – returns invoices for the logged-in parent.
  - `contact-treasurer` – sends an email via SES.
  - `admin-upload-ledger` – S3-triggered ETL to parse `.xlsm` ledgers (MW/SL/VO) and write/update invoices in DynamoDB.
- **Frontend (Vite + React)**: Login buttons (Cognito Hosted UI), Invoice page, Contact Treasurer. Payment UI is omitted for now.

## Repo layout
```
cdk/                # AWS CDK app (infra)
lambda/             # Lambda handlers (Node + TypeScript)
frontend/           # React app (Vite)
```

## Prereqs
- Node 20+, npm
- AWS CLI configured, CDK v2 (npx cdk)
- A DNS domain you can verify in SES (optional until emailing is needed)

## Deploy (sandbox/test)
1) **Bootstrap CDK** (only once per account/region)
```
cd cdk
npm i
npm run build
npx cdk bootstrap
```
2) **Deploy**
```
npx cdk deploy
```
3) **Frontend ENV**
Copy `frontend/.env.example` to `frontend/.env` and set values from CDK outputs.
Then:
```
cd ../frontend
npm i
npm run build
# Deploy build/ to the S3 website bucket (see CDK output). You can also use aws s3 sync.
```

## Admin XLSM ingest
- Upload your `.xlsm` to the **uploads S3 bucket** shown in outputs.
- This triggers the `admin-upload-ledger` Lambda which parses MW/SL/VO tabs and updates invoices.
- Starting rows are configurable: MW=76, SL=74, VO=46. Adjust in `lambda/admin-upload-ledger.ts` if needed.
- Column mapping is adjustable (defaults: cast number = column A, student name = column B, fee = column E, credit = column F).

## Notes
- SES is created but you need to **verify your domain** and move SES out of sandbox.
- Google/Facebook login must be configured in Cognito IdP settings; meanwhile, Email/Password works via Hosted UI.
- Costs stay very low: S3+CloudFront, Cognito MAUs, on-demand DynamoDB, Lambda per-invoke, SES per email.
