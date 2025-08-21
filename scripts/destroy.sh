#!/bin/bash
set -e

echo "WARNING: This will destroy all resources including data in S3 buckets!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Destruction cancelled."
  exit 0
fi

if [ -f "stack-outputs.json" ]; then
  SITE_BUCKET=$(cat stack-outputs.json | grep SiteBucketName | cut -d'"' -f4 || true)
  UPLOADS_BUCKET=$(cat stack-outputs.json | grep UploadsBucketName | cut -d'"' -f4 || true)
  
  if [ ! -z "$SITE_BUCKET" ]; then
    echo "Emptying site bucket: $SITE_BUCKET"
    aws s3 rm s3://$SITE_BUCKET --recursive || true
  fi
  
  if [ ! -z "$UPLOADS_BUCKET" ]; then
    echo "Emptying uploads bucket: $UPLOADS_BUCKET"
    aws s3 rm s3://$UPLOADS_BUCKET --recursive || true
  fi
fi

echo "Destroying CDK stack..."
cd cdk
npx cdk destroy --force

cd ..
rm -f stack-outputs.json
rm -f frontend/.env

echo "Destruction complete!"
echo ""
echo "Note: The following may require manual cleanup:"
echo "- Google/Facebook OAuth app credentials (if configured)"
echo "- ACM certificates (if created for custom domain)"
echo "- DNS records in Squarespace (if configured)"
