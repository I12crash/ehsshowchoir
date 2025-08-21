#!/bin/bash
set -e

if [ ! -f "stack-outputs.json" ]; then
  echo "Error: stack-outputs.json not found. Run deploy-infra.sh first."
  exit 1
fi

DISTRIBUTION_ID=$(cat stack-outputs.json | grep CloudFrontDistributionId | cut -d'"' -f4)

echo "Invalidating CloudFront distribution: $DISTRIBUTION_ID"
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text

echo "Cache invalidation initiated!"
