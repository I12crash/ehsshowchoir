#!/bin/bash
# Infrastructure Deployment Script

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🏗️  Deploying EHS Show Choir Infrastructure${NC}"

# Check AWS CLI
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-us-east-2}

echo -e "${GREEN}✅ AWS Account: ${AWS_ACCOUNT}${NC}"
echo -e "${GREEN}✅ AWS Region: ${AWS_REGION}${NC}"

cd cdk

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing CDK dependencies...${NC}"
    npm install
fi

# Build TypeScript
echo -e "${BLUE}🔨 Building CDK code...${NC}"
npm run build

# Bootstrap CDK if needed
echo -e "${BLUE}🚀 Checking CDK bootstrap...${NC}"
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region ${AWS_REGION} &> /dev/null; then
    echo -e "${YELLOW}⚠️  CDK not bootstrapped. Bootstrapping now...${NC}"
    npx cdk bootstrap aws://${AWS_ACCOUNT}/${AWS_REGION}
fi

# Deploy infrastructure
echo -e "${BLUE}📡 Deploying infrastructure...${NC}"
npx cdk deploy --all --require-approval never --outputs-file ../stack-outputs.json

cd ..

echo -e "${GREEN}✅ Infrastructure deployment completed!${NC}"

# Show next steps
if [ -f "stack-outputs.json" ]; then
    echo ""
    echo -e "${YELLOW}🌐 Next Steps:${NC}"
    CLOUDFRONT_DOMAIN=$(cat stack-outputs.json | jq -r '.EhsShowchoirStack.CloudFrontDomainName // empty' 2>/dev/null || echo "")
    if [ -n "$CLOUDFRONT_DOMAIN" ]; then
        echo "1. Add DNS record in Squarespace:"
        echo "   Type: CNAME, Host: www, Points to: ${CLOUDFRONT_DOMAIN}"
        echo "2. Wait for SSL certificate validation"
        echo "3. Deploy frontend: ./scripts/deploy-frontend.sh"
    fi
fi
