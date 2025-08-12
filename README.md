# Show Choir Billing — Option A (v5) — us-east-2
- AWS SDK v3 in Lambdas, bundled via Docker
- Cognito Hosted UI (implicit + code grants), CORS enabled
- Choir‑scoped student IDs: `<CHOIR>-CAST<NUMBER>` (e.g., `MW-CAST101`)
- Admin endpoint/page: `/admin/students` with CSV download
- Lambdas live in `cdk/lambda/`; CDK `tsconfig` excludes them

## Deploy (infra)
```bash
cd cdk
npm i
npm run build
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
npx cdk bootstrap aws://$ACCOUNT_ID/us-east-2
npx cdk deploy --region us-east-2
```

## Frontend
Set `frontend/.env` from outputs:
```ini
VITE_API_URL=https://<ApiUrl>
VITE_COGNITO_DOMAIN=https://edgewood-choir-billing-test.auth.us-east-2.amazoncognito.com
VITE_COGNITO_CLIENT_ID=<UserPoolClientId>
VITE_COGNITO_CALLBACK=http://localhost:5173/callback
```
Build & publish:
```bash
cd ../frontend
npm i
npm run build
REGION=us-east-2
BUCKET=$(aws cloudformation describe-stacks --stack-name ShowChoirBillingStack   --query "Stacks[0].Outputs[?OutputKey=='SiteBucketName'].OutputValue"   --output text --region $REGION)
aws s3 sync dist/ s3://$BUCKET --delete --region $REGION

# Optional: invalidate CloudFront
DIST_ID=$(aws cloudformation describe-stacks --stack-name ShowChoirBillingStack   --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue"   --output text --region $REGION)
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

## Reseed data (choir‑scoped IDs)
Upload your `.xlsm` to the uploads bucket:
```bash
REGION=us-east-2
UPLOADS=$(aws cloudformation describe-stacks --stack-name ShowChoirBillingStack   --query "Stacks[0].Outputs[?OutputKey=='UploadsBucketName'].OutputValue"   --output text --region $REGION)
aws s3 cp "/path/to/ledger.xlsm" s3://$UPLOADS/
```
