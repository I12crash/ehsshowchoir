#!/usr/bin/env bash
set -euo pipefail

REGION="us-east-2"
STACK="ShowChoirBillingStack"

API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK"   --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue"   --output text --region "$REGION")

COGNITO_DOMAIN=$(aws cloudformation describe-stacks --stack-name "$STACK"   --query "Stacks[0].Outputs[?OutputKey=='HostedUIDomain'].OutputValue"   --output text --region "$REGION")

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$STACK"   --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue"   --output text --region "$REGION")

CALLBACK_DEFAULT="http://localhost:5173/callback"

cat > ../.env <<EOF
VITE_API_URL=${API_URL}
VITE_COGNITO_DOMAIN=${COGNITO_DOMAIN}
VITE_COGNITO_CLIENT_ID=${USER_POOL_CLIENT_ID}
VITE_COGNITO_CALLBACK=${VITE_COGNITO_CALLBACK:-$CALLBACK_DEFAULT}
EOF

echo "Wrote ../.env:"
cat ../.env
