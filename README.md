# Show Choir Billing (AWS, us-east-2)

Minimal, low-cost stack to track invoices, allow Cognito login, list students, and email the treasurer.  
Infra: CDK (Cognito, DynamoDB, S3+CloudFront, Lambda, API Gateway).  
Frontend: React + Vite (S3/CloudFront).

---

## Prereqs
- AWS CLI v2 (`aws configure`), account with permission to deploy
- Node.js v20+
- **Docker Desktop** running (Lambda bundling uses Docker)
- macOS/Linux shell (or Windows PowerShell)
- Optional: `jq`

---

## Quickstart (scripts)

### 1) Deploy infrastructure
```bash
# From repo root
REGION=us-east-2 ./scripts/deploy-infra.sh
```

### 2) Deploy frontend (build + upload + invalidate CF)
```bash
# From repo root
REGION=us-east-2 ./scripts/deploy-frontend.sh
# Windows PowerShell:
# pwsh -File .\scripts\deploy-frontend.ps1
```

That’s it. Your site URL prints at the end (CloudFront domain).

---

## What the scripts do

### `scripts/deploy-infra.sh`
- Runs `npm i && npm run build` in `cdk/`
- `cdk bootstrap` for your account/region (safe to repeat)
- `cdk deploy` to create/update all AWS resources

### `scripts/deploy-frontend.sh` / `.ps1`
- Reads CloudFormation outputs to get:
  - `ApiUrl`, `SiteBucketName`, `CloudFrontDomain`, `CloudFrontDistributionId`,
  - `HostedUIDomain` (Cognito Hosted UI), `UserPoolClientId`
- Writes `frontend/.env` with the right values
- Builds the SPA (`npm i && npm run build` in `frontend/`)
- Uploads `dist/` to the **Site** S3 bucket
- Invalidates CloudFront (best effort) so changes go live

If outputs are missing, the script falls back to stack resources for bucket and distribution IDs.

---

## Manual deployment (if you prefer step-by-step)

### A) Infra
```bash
cd cdk
npm i
npm run build
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
npx cdk bootstrap aws://$ACCOUNT_ID/us-east-2
npx cdk deploy --region us-east-2
```

### B) Frontend
Fill `.env` or let the script do it:
```bash
cd ../frontend
cp .env.example .env   # then edit values (ApiUrl, Cognito domain, client ID, callback)
npm i
npm run build
SITE_BUCKET=$(aws cloudformation describe-stacks --stack-name ShowChoirBillingStack   --query "Stacks[0].Outputs[?OutputKey=='SiteBucketName'].OutputValue"   --output text --region us-east-2)
aws s3 sync dist/ "s3://$SITE_BUCKET" --delete --region us-east-2
DIST_ID=$(aws cloudformation describe-stack-resources --stack-name ShowChoirBillingStack   --query "StackResources[?ResourceType=='AWS::CloudFront::Distribution'].PhysicalResourceId"   --output text --region us-east-2)
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
```

---

## Seed data

Upload your `.xlsm` to the Uploads bucket to populate invoices:
```bash
REGION=us-east-2
UPLOADS_BUCKET=$(aws cloudformation describe-stacks --stack-name ShowChoirBillingStack   --query "Stacks[0].Outputs[?OutputKey=='UploadsBucketName'].OutputValue"   --output text --region $REGION)
aws s3 cp "/path/to/ledger.xlsm" "s3://$UPLOADS_BUCKET/"
```

Student IDs are **choir-scoped** (e.g., `MW-CAST101`, `SL-CAST101`).

---

## Test the app
- Site: `https://<CloudFrontDomain>` (printed by deploy script)
- Hosted UI login via Email/Password, Google, Facebook (IdPs optional; configure in Cognito)
- Home `/`: invoice view (uses sandbox `TEST-PARENT` if not signed in)
- Admin students `/admin/students`: table + “Download CSV” (JSON or `?format=csv`)

---

## Troubleshooting
- **`SITE_BUCKET` empty**: wrong region/stack name, or stack not deployed. The deploy script prints values it resolved.
- **Docker bundling errors**: start Docker Desktop and re-run infra deploy.
- **SES sending**: verify From and recipients in us-east-2 while in SES sandbox.
- **CloudFront cache**: the script invalidates, but propagation may take a minute.

---

## Clean up
```bash
cd cdk
npx cdk destroy --region us-east-2
# Empty S3 buckets first if destroy fails due to non-empty buckets.
```

---

## Notes
- The Hosted UI domain output **already includes** `https://`.
- Default season is `2025-2026` (change via `DEFAULT_SEASON` env in CDK).
- Next enhancements available on request: JWT authorizer, parent↔student CSV importer, Square payments.
