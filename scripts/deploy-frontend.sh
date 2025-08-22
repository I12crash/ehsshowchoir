#!/bin/bash
# Frontend Deployment Script

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Deploying EHS Show Choir Frontend${NC}"

# Check if stack outputs exist
if [ ! -f "stack-outputs.json" ]; then
    echo -e "${RED}❌ stack-outputs.json not found. Deploy infrastructure first.${NC}"
    exit 1
fi

# Extract values from stack outputs
if command -v jq >/dev/null 2>&1; then
    BUCKET_NAME=$(cat stack-outputs.json | jq -r '.EhsShowchoirStack.WebsiteBucketName // empty')
    DISTRIBUTION_ID=$(cat stack-outputs.json | jq -r '.EhsShowchoirStack.CloudFrontDistributionId // empty')
    API_URL=$(cat stack-outputs.json | jq -r '.EhsShowchoirStack.ApiUrl // empty')
    USER_POOL_ID=$(cat stack-outputs.json | jq -r '.EhsShowchoirStack.UserPoolId // empty')
    CLIENT_ID=$(cat stack-outputs.json | jq -r '.EhsShowchoirStack.UserPoolClientId // empty')
    COGNITO_DOMAIN=$(cat stack-outputs.json | jq -r '.EhsShowchoirStack.CognitoDomain // empty')
else
    echo -e "${RED}❌ jq not found. Please install jq: sudo apt-get install jq${NC}"
    exit 1
fi

if [ -z "$BUCKET_NAME" ] || [ -z "$DISTRIBUTION_ID" ]; then
    echo -e "${RED}❌ Missing required stack outputs${NC}"
    exit 1
fi

echo -e "${GREEN}✅ S3 Bucket: ${BUCKET_NAME}${NC}"
echo -e "${GREEN}✅ Distribution: ${DISTRIBUTION_ID}${NC}"

# Create environment file
echo -e "${BLUE}🔧 Creating environment configuration...${NC}"
cat > frontend/.env << EOF_ENV
VITE_API_URL=${API_URL}
VITE_COGNITO_USER_POOL_ID=${USER_POOL_ID}
VITE_COGNITO_CLIENT_ID=${CLIENT_ID}
VITE_COGNITO_DOMAIN=${COGNITO_DOMAIN}
VITE_CALLBACK_URL=https://edgewoodshowchoirpayments.org
VITE_AWS_REGION=us-east-2
EOF_ENV

cd frontend

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
    npm install
fi

# Build frontend
echo -e "${BLUE}🏗️  Building frontend...${NC}"
npm run build

# Upload to S3
echo -e "${BLUE}📤 Uploading to S3...${NC}"
aws s3 sync dist/ s3://$BUCKET_NAME --delete

# Invalidate cache
echo -e "${BLUE}🔄 Invalidating CloudFront cache...${NC}"
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"

cd ..

echo -e "${GREEN}🎉 Frontend deployment completed!${NC}"
echo -e "${GREEN}🌐 Website: https://edgewoodshowchoirpayments.org${NC}"
