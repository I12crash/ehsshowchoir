#!/usr/bin/env bash
set -euo pipefail

REGION="${REGION:-us-east-2}"
STACK="${STACK:-ShowChoirBillingStack}"

echo "Deploying infrastructure to region: $REGION (stack: $STACK)"
cd "$(dirname "$0")/../cdk"

# Install & build
npm i
npm run build

# Bootstrap (safe if already bootstrapped)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
npx cdk bootstrap "aws://$ACCOUNT_ID/$REGION"

# Deploy
npx cdk deploy --region "$REGION"
