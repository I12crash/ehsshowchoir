#!/bin/bash
# Complete Deployment Guide for EHS Show Choir Payment System

echo "🚀 EHS Show Choir Deployment Guide"
echo "=================================="
echo ""
echo "This guide will help you deploy the complete system step by step."
echo ""

# Step 1: Create the deployment scripts
echo "📝 Step 1: Creating deployment scripts..."
echo ""

# Create scripts directory
mkdir -p scripts

# Create infrastructure deployment script
cat > scripts/deploy-infra.sh << 'EOF'
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
EOF

# Create frontend deployment script
cat > scripts/deploy-frontend.sh << 'EOF'
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
EOF

# Create complete deployment script
cat > scripts/deploy-all.sh << 'EOF'
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
EOF

# Make scripts executable
chmod +x scripts/*.sh

echo "✅ Deployment scripts created successfully!"
echo ""
echo "📋 Now let's proceed with the deployment:"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org"
    exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm first."
    exit 1
fi

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI first."
    echo "   Visit: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check CDK
if ! command -v cdk &> /dev/null; then
    echo "⚠️  AWS CDK not found. Installing now..."
    npm install -g aws-cdk
fi

# Check jq
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq not found. Please install jq:"
    echo "   Ubuntu/Debian: sudo apt-get install jq"
    echo "   MacOS: brew install jq"
    echo "   Windows: Download from https://stedolan.github.io/jq/"
    exit 1
fi

echo "✅ All prerequisites met!"
echo ""

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials not configured."
    echo ""
    echo "Please configure AWS credentials:"
    echo "  aws configure"
    echo ""
    echo "You'll need:"
    echo "  • AWS Access Key ID"
    echo "  • AWS Secret Access Key"  
    echo "  • Default region: us-east-2"
    echo "  • Default output format: json"
    exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "✅ AWS Account: ${AWS_ACCOUNT}"
echo ""

# Check if this is a fresh setup or existing repository
if [ ! -f "package.json" ]; then
    echo "🏗️  Setting up project structure..."
    
    # Create package.json
    cat > package.json << 'EOF'
{
  "name": "ehsshowchoir",
  "version": "1.0.0",
  "description": "Edgewood Show Choir Payment System",
  "scripts": {
    "install-all": "npm install && cd cdk && npm install && cd ../frontend && npm install && cd ..",
    "deploy-infra": "./scripts/deploy-infra.sh",
    "deploy-frontend": "./scripts/deploy-frontend.sh", 
    "deploy-all": "./scripts/deploy-all.sh"
  }
}
EOF

    echo "✅ Project structure created"
fi

echo ""
echo "🚀 Ready to deploy! Choose an option:"
echo ""
echo "1. Deploy everything (recommended): ./scripts/deploy-all.sh"
echo "2. Deploy infrastructure only: ./scripts/deploy-infra.sh"
echo "3. Deploy frontend only: ./scripts/deploy-frontend.sh"
echo ""
echo "For first-time deployment, choose option 1."
echo ""
echo "⚠️  Important Notes:"
echo "• Deployment takes 10-15 minutes"
echo "• You'll need to configure DNS in Squarespace after infrastructure deployment"
echo "• SSL certificate validation may take up to 30 minutes"
echo "• SES email setup requires additional configuration"
echo ""

read -p "Would you like to deploy everything now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Starting complete deployment..."
    ./scripts/deploy-all.sh
else
    echo ""
    echo "👍 Deployment scripts are ready when you are!"
    echo "Run './scripts/deploy-all.sh' when ready to deploy."
fi
