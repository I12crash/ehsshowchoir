
# Edgewood Show Choir Billing (ehsshowchoir)

A low-cost AWS-hosted web app to track student expenses/credits across **Music Warehouse (MW)**, **Sophisticated Ladies (SL)**, and **Vocal Odyssey (VO)**.

- Parents authenticate via **Cognito Hosted UI** (Email/Password + Google + Facebook).
- Parents see their **student invoice** and can contact the Treasurer.
- Admin can **add/remove students**, **edit gender & grade (9–12)**, add single **transactions**, and **batch-charge** choirs (with MW Male/Female selector).
- Data stored in **DynamoDB**: 1 table, flexible schema.
- Frontend is **static** (S3 + CloudFront), backend is **Lambda + API Gateway**.
- Default region: **us-east-2**.

> NOTE: Google & Facebook require configuring IdPs in Cognito (documented below). Until then, Email/Password works immediately.

---

## Architecture

- **DynamoDB** table (primary keys: `PK`, `SK`)
  - Student profile: `PK=STUDENT#<id>`, `SK=PROFILE`, attributes: `studentId`, `studentName`, `choir (MW/SL/VO)`, `gender (M/F)`, `grade (9–12)`, `active`
  - Transactions: `PK=STUDENT#<id>`, `SK=TXN#<season>#<timestamp>#<rand>`, attributes: `type (fee|credit)`, `amountCents`, `date`, `season`, `category`, `description`
  - Parent links (optional for invoice by parent): `PK=PARENT#<email>`, `SK=LINK#<studentId>`
- **GSIs**
  - `TypeIndex` → `TYPE` (PK), `studentName` (SK) — list profiles
  - `EmailIndex` → `GSI1PK` (PK), `GSI1SK` (SK) — list student links by email
- **Auth**: Cognito User Pool + Hosted UI (domain), with optional IdPs (Google, Facebook)
- **API** (API Gateway + Lambda)
  - `GET /me/invoice` — compute balance from TXNs (by `parentEmail`, or `studentId` for testing)
  - `/admin/students` (GET/POST/DELETE) — list/upsert/soft-delete students
  - `/admin/transaction` (POST) — add fee/credit
  - `/admin/batch/charge` (POST) — apply fee to whole choir (MW supports Male/Female subset)
  - All `/admin/*` require Cognito JWT; **Admin** = `showchoirtreasurer@gmail.com`; **Read-only** emails allowed to read `/admin/students` only
- **Frontend**: Vite + React + TS; Edgewood-themed (hero banner, condensed nav, Montserrat font, branded Google/Facebook buttons).

---

## Prereqs

- Node.js 18+ (Node 20+ recommended)
- AWS CLI configured with credentials
- [AWS CDK v2](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html) (`npm i -g aws-cdk`)

---

## One-time: bootstrap CDK in your AWS account

```bash
cd cdk
npm i
npx cdk bootstrap aws://$AWS_ACCOUNT_ID/us-east-2
```

> If you see deprecation warnings for CloudFront S3 origin classes, they are safe to ignore.

---

## Deploy — Infra + Frontend

From repo root:

```bash
# 1) Infra (creates Cognito, API, DynamoDB, S3+CloudFront)
REGION=us-east-2 ./scripts/deploy-infra.sh

# 2) Frontend (builds, uploads, invalidates CloudFront)
REGION=us-east-2 ./scripts/deploy-frontend.sh
```

The frontend script resolves CloudFormation outputs and writes `frontend/.env` automatically:

```
VITE_API_URL=...
VITE_COGNITO_DOMAIN=...
VITE_COGNITO_CLIENT_ID=...
VITE_COGNITO_CALLBACK=http://localhost:5173/callback
VITE_ADMIN_EMAIL=showchoirtreasurer@gmail.com
VITE_READONLY_EMAILS=
```

Open your CloudFront domain from the output—e.g., `https://dxxxxxxxxxxxx.cloudfront.net/`

---

## Configure Cognito Hosted UI

- In the AWS Console → Cognito → your User Pool
  - **Domain**: set a domain (e.g., `edgewood-choir-billing-test`); note it (the script picks it up).
  - **App client**: ensure implicit grant is enabled (ID token).
  - **Callback URL**: `http://localhost:5173/callback` (local) and your CloudFront URL `/callback` (prod).

### Add Google / Facebook (optional now, required for those buttons)

- **Google**: create OAuth credentials, add as Cognito IdP; whitelist the callback above.
- **Facebook**: create an app, add as Cognito IdP; whitelist the callback above.
- Update the App client to include these IdPs.

---

## Data loading & usage

- **Add students**: `/admin/manage` → “Add / Update Student”
- **Edit gender / grade**: `/admin/students` → inline dropdowns → **Save**
- **Batch charge**: `/admin/manage` → “Batch Charge” (choose choir; MW has Male/Female filter)
- **Per-student fee/credit**: `/admin/manage` → “Add Single Transaction”

### Parent ↔ Student links
- For production invoices by parent email, add link items:
  - `PK=PARENT#parent@example.com`, `SK=LINK#MW-CAST101`
- You can POST a convenience endpoint:
  - `POST /admin/parent-link` → body `{ parentEmail, studentId }`

---

## Scripts

- `scripts/deploy-infra.sh` — `cd cdk && npm run build && npx cdk deploy`
- `scripts/deploy-frontend.sh` — pulls CFN outputs → writes `.env` → `npm i && npm run build` → S3 sync → CloudFront invalidation

---

## Local dev for frontend

```bash
cd frontend
cp .env.example .env   # (optional; the deploy script overwrites .env for prod)
npm i
npm run dev
```

---

## Troubleshooting

- **CDK bundling asks for package.json**: We set each Lambda to use the CDK project as `projectRoot`, so the bundler finds dependencies.
- **Vite build errors**: Run from `frontend/` and ensure `.env` has the variables. The deploy script regenerates it for prod.
- **SES emails**: You must verify your sender address (e.g., `showchoirtreasurer@gmail.com`) in SES v2 or use a verified domain.

---

## Costs

All resources are eligible for free/low-cost tiers: DynamoDB on-demand (small), Lambda, API Gateway, S3, CloudFront, Cognito. Remember SES may charge for outbound emails beyond the free tier in certain regions.

---
