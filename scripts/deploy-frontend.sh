#!/usr/bin/env bash
set -euo pipefail

REGION="${REGION:-us-east-2}"
STACK="${STACK:-ShowChoirBillingStack}"
CALLBACK_DEFAULT="${CALLBACK_DEFAULT:-http://localhost:5173/callback}"

echo "Resolving CloudFormation outputs in $REGION for $STACK..."

# Outputs
API_URL=$(aws cloudformation describe-stacks --stack-name "$STACK"   --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue"   --output text --region "$REGION" || true)

SITE_BUCKET=$(aws cloudformation describe-stacks --stack-name "$STACK"   --query "Stacks[0].Outputs[?OutputKey=='SiteBucketName'].OutputValue"   --output text --region "$REGION" || true)

CF_DOMAIN=$(aws cloudformation describe-stacks --stack-name "$STACK"   --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomain'].OutputValue"   --output text --region "$REGION" || true)

DIST_ID=$(aws cloudformation describe-stacks --stack-name "$STACK"   --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue"   --output text --region "$REGION" || true)

COGNITO_DOMAIN=$(aws cloudformation describe-stacks --stack-name "$STACK"   --query "Stacks[0].Outputs[?OutputKey=='HostedUIDomain'].OutputValue"   --output text --region "$REGION" || true)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name "$STACK"   --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue"   --output text --region "$REGION" || true)

# Fallbacks if outputs missing
if [[ -z "$SITE_BUCKET" || "$SITE_BUCKET" == "None" ]]; then
  SITE_BUCKET=$(aws cloudformation describe-stack-resources --stack-name "$STACK"     --query "StackResources[?ResourceType=='AWS::S3::Bucket' && starts_with(LogicalResourceId, 'SiteBucket')].PhysicalResourceId"     --output text --region "$REGION" || true)
fi

if [[ -z "$DIST_ID" || "$DIST_ID" == "None" ]]; then
  # Try match by domain if we have it
  if [[ -n "${CF_DOMAIN:-}" && "$CF_DOMAIN" != "None" ]]; then
    DIST_ID=$(aws cloudfront list-distributions       --query "DistributionList.Items[?DomainName=='$CF_DOMAIN'].Id"       --output text || true)
  fi
  # Otherwise, take the first distribution from stack resources
  if [[ -z "$DIST_ID" || "$DIST_ID" == "None" ]]; then
    DIST_ID=$(aws cloudformation describe-stack-resources --stack-name "$STACK"       --query "StackResources[?ResourceType=='AWS::CloudFront::Distribution'].PhysicalResourceId"       --output text --region "$REGION" || true)
  fi
fi

if [[ -z "$API_URL" || "$API_URL" == "None" ]]; then
  echo "ERROR: Could not resolve API_URL from outputs. Is the stack deployed?"; exit 1
fi
if [[ -z "$SITE_BUCKET" || "$SITE_BUCKET" == "None" ]]; then
  echo "ERROR: Could not resolve SITE_BUCKET from outputs/resources."; exit 1
fi

echo "API_URL=$API_URL"
echo "SITE_BUCKET=$SITE_BUCKET"
echo "CF_DOMAIN=${CF_DOMAIN:-}"
echo "DIST_ID=${DIST_ID:-}"
echo "COGNITO_DOMAIN=${COGNITO_DOMAIN:-}"
echo "USER_POOL_CLIENT_ID=${USER_POOL_CLIENT_ID:-}"

# Write frontend/.env
pushd "$(dirname "$0")/.." >/dev/null
cat > .env <<EOF
VITE_API_URL=$API_URL
VITE_COGNITO_DOMAIN=${COGNITO_DOMAIN:-https://edgewood-choir-billing-test.auth.$REGION.amazoncognito.com}
VITE_COGNITO_CLIENT_ID=${USER_POOL_CLIENT_ID:-REPLACE_WITH_CLIENT_ID}
VITE_COGNITO_CALLBACK=${VITE_COGNITO_CALLBACK:-$CALLBACK_DEFAULT}
EOF

echo "Wrote .env:"
cat .env

# Build
npm i
npm run build

# Sync to S3
aws s3 sync dist/ "s3://$SITE_BUCKET" --delete --region "$REGION"

# Invalidate CloudFront (best effort)
if [[ -n "${DIST_ID:-}" && "$DIST_ID" != "None" ]]; then
  echo "Creating CloudFront invalidation on distribution $DIST_ID ..."
  aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" >/dev/null || true
  echo "Done."
else
  echo "No CloudFront distribution ID found; skipping invalidation."
fi

echo "Deployed. Site should be available at: https://${CF_DOMAIN:-<your-cloudfront-domain>}"
popd >/dev/null
