#!/bin/bash

# Quick Fix - Add CDK Outputs for EHS Show Choir
# This script quickly adds the essential outputs needed for frontend deployment

set -e

echo "🚀 Quick Fix - Adding CDK Outputs"
echo "================================="

# Find the stack file
STACK_FILE=$(find cdk -name "*stack*.ts" | head -1)
if [ -z "$STACK_FILE" ]; then
    echo "❌ No CDK stack file found"
    exit 1
fi

echo "📄 Using stack file: $STACK_FILE"

# Backup original
cp "$STACK_FILE" "${STACK_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "💾 Backup created"

# Check if already has outputs
if grep -q "CfnOutput" "$STACK_FILE"; then
    echo "ℹ️  Outputs already exist, skipping..."
    exit 0
fi

# Add CfnOutput import if missing
if ! grep -q "import.*CfnOutput" "$STACK_FILE"; then
    echo "📦 Adding CfnOutput import..."
    sed -i.tmp '1s/$/\nimport { CfnOutput } from "aws-cdk-lib";/' "$STACK_FILE"
    rm -f "${STACK_FILE}.tmp"
fi

# Add outputs before the last closing brace
echo "🔧 Adding essential outputs..."

# Create the outputs to insert
cat > /tmp/outputs.ts << 'EOF'

    // Essential outputs for frontend deployment
    new CfnOutput(this, 'WebsiteUrl', {
      value: `https://${this.distribution?.distributionDomainName || 'PLACEHOLDER'}`,
      description: 'Website URL'
    });

    new CfnOutput(this, 'ApiUrl', {
      value: this.api?.url || this.restApi?.url || 'PLACEHOLDER',
      description: 'API Gateway URL'
    });

    new CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region'
    });
EOF

# Insert outputs before the last two closing braces
head -n -2 "$STACK_FILE" > /tmp/stack_temp.ts
cat /tmp/outputs.ts >> /tmp/stack_temp.ts
tail -n 2 "$STACK_FILE" >> /tmp/stack_temp.ts
mv /tmp/stack_temp.ts "$STACK_FILE"

# Clean up
rm -f /tmp/outputs.ts

echo "✅ Outputs added successfully!"
echo ""
echo "🚀 Next steps:"
echo "1. cd cdk && npm run build && npx cdk deploy"
echo "2. ./scripts/deploy-frontend.sh"

# Auto-run if requested
echo ""
read -p "🤖 Auto-run deployment now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Running deployment..."
    cd cdk
    npm run build
    npx cdk deploy --require-approval never
    
    cd ..
    echo "🌐 Checking outputs..."
    aws cloudformation describe-stacks --stack-name EhsShowchoirStack --query 'Stacks[0].Outputs' --region us-east-2
    
    echo "🎯 Trying frontend deployment..."
    ./scripts/deploy-frontend.sh
fi
