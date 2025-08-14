#!/usr/bin/env bash
set -euo pipefail

: "${REGION:=us-east-2}"
STACK_NAME="ShowChoirBillingStack"

echo
echo "Resolving CloudFormation outputs in $REGION for $STACK_NAME..."
outputs=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Outputs")

API_URL=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="ApiBaseUrl") | .OutputValue')
SITE_BUCKET=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="SiteBucketName") | .OutputValue')
CF_DOMAIN=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="CloudFrontDomain") | .OutputValue')
DIST_ID=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="CloudFrontDistributionId") | .OutputValue')
COGNITO_DOMAIN=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="CognitoHostedDomain") | .OutputValue')
USER_POOL_CLIENT_ID=$(echo "$outputs" | jq -r '.[] | select(.OutputKey=="UserPoolClientId") | .OutputValue')

echo "API_URL=$API_URL"
echo "SITE_BUCKET=$SITE_BUCKET"
echo "CF_DOMAIN=$CF_DOMAIN"
echo "DIST_ID=$DIST_ID"
echo "COGNITO_DOMAIN=$COGNITO_DOMAIN"
echo "USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID"

pushd frontend >/dev/null

cat > .env <<EOF
VITE_API_URL=$API_URL
VITE_COGNITO_DOMAIN=https://$COGNITO_DOMAIN
VITE_COGNITO_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_COGNITO_CALLBACK=http://localhost:5173/callback
VITE_ADMIN_EMAIL=showchoirtreasurer@gmail.com
VITE_READONLY_EMAILS=
EOF

echo "Wrote .env:"
cat .env

npm i
npm run build

aws s3 sync dist/ "s3://$SITE_BUCKET" --delete --region "$REGION"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null

echo
echo "Deployed. Visit: https://$CF_DOMAIN/"
popd >/dev/null
