#!/bin/bash
set -e

if [ ! -f "stack-outputs.json" ]; then
  echo "Error: stack-outputs.json not found. Run deploy-infra.sh first."
  exit 1
fi

SITE_BUCKET=$(cat stack-outputs.json | grep SiteBucketName | cut -d'"' -f4)
DISTRIBUTION_ID=$(cat stack-outputs.json | grep CloudFrontDistributionId | cut -d'"' -f4)

echo "Building frontend..."
cd frontend
npm run build

echo "Uploading to S3 bucket: $SITE_BUCKET"
aws s3 sync dist/ s3://$SITE_BUCKET/ --delete

echo "Invalidating CloudFront distribution: $DISTRIBUTION_ID"
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text

echo "Frontend deployment complete!"
echo "Site URL: $(cat ../stack-outputs.json | grep CloudFrontURL | cut -d'"' -f4)"
