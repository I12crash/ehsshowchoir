# Foster.dev AWS Application

A full-stack AWS application with CDK infrastructure, React frontend, and Cognito authentication.

## Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with credentials
- AWS CDK CLI: `npm install -g aws-cdk`
- Valid AWS account with permissions for CloudFormation, S3, CloudFront, Lambda, API Gateway, Cognito

## Project Structure

```
.
├── cdk/                 # CDK infrastructure code
│   ├── lib/            # Stack definitions
│   ├── lambda/         # Lambda function source
│   └── bin/            # CDK app entry
├── frontend/           # React + Vite + Amplify frontend
│   ├── src/
│   └── public/
├── scripts/            # Deployment automation
├── README.md
└── package.json
```

## Quick Start

1. **Install Dependencies**
```bash
npm install
cd cdk && npm install && cd ..
cd frontend && npm install && cd ..
```

2. **Configure Environment**
```bash
export AWS_REGION=us-east-2
export HOSTED_UI_PREFIX=foster-dev-auth
```

3. **Bootstrap CDK** (first time only)
```bash
./scripts/bootstrap.sh
```

4. **Deploy Infrastructure**
```bash
./scripts/deploy-infra.sh
```

5. **Deploy Frontend**
```bash
./scripts/deploy-frontend.sh
```

6. **Access the Application**
- Check `stack-outputs.json` for CloudFront URL
- Or run: `cat stack-outputs.json | jq -r .CloudFrontDomainName`

## Domain Setup (edgewoodshowchoirpayments.org)

### ACM Certificate (us-east-1 for CloudFront)
1. The CDK stack creates a certificate request in us-east-1
2. Add the CNAME validation records to Squarespace DNS
3. Wait for validation to complete
4. Update CloudFront with the certificate

### DNS Configuration (Squarespace)
Add CNAME record:
- Host: `www` (or your chosen subdomain)
- Points to: CloudFront distribution domain (e.g., `d1234567890.cloudfront.net`)

## Authentication Setup

### Email/Password
Works out of the box with Cognito User Pool.

### Social Providers (Google/Facebook)
1. Create OAuth apps in Google/Facebook developer consoles
2. Add credentials to Cognito User Pool:
   - AWS Console → Cognito → User Pools → Your Pool
   - Sign-in experience → Federated identity providers
   - Add Google/Facebook with your app credentials
3. Update Hosted UI settings with callback URLs
4. Social sign-in buttons appear automatically in the frontend

### Admin User
To allow `showchoirtreasurer@gmail.com` to sign in:
- They can register with email/password
- Or sign in with Google once configured

## Useful Commands

### Infrastructure
```bash
# View stack outputs
cat stack-outputs.json | jq

# Get CloudFront URL
aws cloudformation describe-stacks --stack-name FosterDevStack \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
  --output text

# Test API health
curl $(cat stack-outputs.json | jq -r .ApiUrl)/health
```

### Troubleshooting
```bash
# Check CDK diff
cd cdk && npx cdk diff

# View Lambda logs
aws logs tail /aws/lambda/FosterDevStack-ApiHandler --follow

# Invalidate CloudFront cache
./scripts/invalidate-cache.sh
```

### Cleanup
```bash
# Destroy all resources
./scripts/destroy.sh
```

## Environment Variables

The frontend `.env` file is auto-generated from stack outputs:
- `VITE_API_URL` - API Gateway endpoint
- `VITE_COGNITO_USER_POOL_ID` - Cognito User Pool ID
- `VITE_COGNITO_CLIENT_ID` - Cognito app client ID
- `VITE_COGNITO_DOMAIN` - Cognito Hosted UI domain
- `VITE_CALLBACK_URL` - OAuth callback URL

## Security Notes

- Never commit `.env` files
- Rotate Cognito app client secrets regularly
- Use least-privilege IAM policies
- Enable CloudTrail for audit logging
- Consider WAF for CloudFront protection
