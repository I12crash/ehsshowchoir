#!/bin/bash
set -e

REGION=${AWS_REGION:-us-east-2}
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

echo "Bootstrapping CDK for account $ACCOUNT in region $REGION..."

cd cdk
npx cdk bootstrap aws://$ACCOUNT/$REGION

echo "CDK bootstrap complete!"
