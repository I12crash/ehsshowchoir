#!/bin/bash
# Complete Deployment Script

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${PURPLE}🚀 EHS Show Choir Complete Deployment${NC}"
echo -e "${PURPLE}====================================${NC}"

# Install all dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm run install-all

# Deploy infrastructure
echo -e "${BLUE}🏗️  Step 1: Deploying infrastructure...${NC}"
./scripts/deploy-infra.sh

# Deploy frontend
echo -e "${BLUE}📱 Step 2: Deploying frontend...${NC}"
./scripts/deploy-frontend.sh

echo -e "${GREEN}🎉 Complete deployment finished!${NC}"

# Show final instructions
if [ -f "stack-outputs.json" ]; then
    CLOUDFRONT_DOMAIN=$(cat stack-outputs.json | jq -r '.EhsShowchoirStack.CloudFrontDomainName // empty' 2>/dev/null || echo "")
    echo ""
    echo -e "${PURPLE}📋 Final Steps:${NC}"
    echo "1. Configure DNS in Squarespace:"
    echo "   • Type: CNAME"
    echo "   • Host: www"
    echo "   • Points to: ${CLOUDFRONT_DOMAIN}"
    echo ""
    echo "2. Set up SES for email:"
    echo "   • Verify domain in Amazon SES console"
    echo "   • Add DKIM records to DNS"
    echo "   • Request production access"
    echo ""
    echo "3. Test the application:"
    echo "   • Visit: https://edgewoodshowchoirpayments.org"
    echo "   • Create user account"
    echo "   • Add test students"
    echo ""
fi
