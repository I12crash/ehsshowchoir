#!/bin/bash

# CDK Syntax Diagnostic and Fix Script
# This script will show the exact problem and fix it

set -e

echo "🔍 CDK Syntax Diagnostic and Fix"
echo "================================"

STACK_FILE="cdk/lib/ehsshowchoir-stack.ts"

if [ ! -f "$STACK_FILE" ]; then
    echo "❌ Stack file not found: $STACK_FILE"
    exit 1
fi

echo "📄 Analyzing: $STACK_FILE"
echo ""

# Show the problem area around line 563
echo "🔍 Lines around the error (560-570):"
echo "====================================="
sed -n '560,570p' "$STACK_FILE" | cat -n
echo "====================================="

echo ""
echo "🔍 Last 20 lines of the file:"
echo "============================="
tail -20 "$STACK_FILE" | cat -n
echo "============================="

echo ""
echo "🔍 Looking for brace balance issues..."

# Count opening and closing braces
OPEN_BRACES=$(grep -o '{' "$STACK_FILE" | wc -l)
CLOSE_BRACES=$(grep -o '}' "$STACK_FILE" | wc -l)

echo "📊 Brace count:"
echo "   Opening braces: $OPEN_BRACES"
echo "   Closing braces: $CLOSE_BRACES"

if [ "$OPEN_BRACES" -ne "$CLOSE_BRACES" ]; then
    echo "❌ Brace mismatch detected!"
    echo "   Difference: $((OPEN_BRACES - CLOSE_BRACES))"
else
    echo "✅ Brace count looks balanced"
fi

echo ""
echo "�� Looking for obvious syntax issues..."

# Check for common issues
if grep -n "new CfnOutput.*$" "$STACK_FILE" | grep -q ",\s*$"; then
    echo "⚠️  Found CfnOutput with trailing comma"
fi

if grep -n "^\s*$" "$STACK_FILE" | tail -5; then
    echo "⚠️  Found empty lines at end"
fi

echo ""
echo "🛠️  Attempting to fix the syntax error..."

# Create a backup
BACKUP_FILE="${STACK_FILE}.syntax-backup.$(date +%Y%m%d_%H%M%S)"
cp "$STACK_FILE" "$BACKUP_FILE"
echo "💾 Backup created: $BACKUP_FILE"

# Try to fix common issues
echo "🔧 Cleaning up the file..."

# Remove any orphaned content and ensure proper structure
python3 << 'PYTHON_FIX'
import re

def fix_cdk_syntax(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Split into lines for analysis
    lines = content.split('\n')
    
    # Find the class definition and constructor
    constructor_start = -1
    constructor_end = -1
    
    for i, line in enumerate(lines):
        if 'constructor(' in line:
            constructor_start = i
        if constructor_start > -1 and line.strip() == '}' and 'export' not in lines[i+1:i+3]:
            # This might be the constructor end
            constructor_end = i
            break
    
    if constructor_start == -1:
        print("❌ Could not find constructor")
        return False
    
    # Clean content: remove any partial outputs and rebuild properly
    clean_lines = []
    in_outputs_section = False
    
    for i, line in enumerate(lines):
        # Skip lines that are part of broken outputs
        if 'new CfnOutput' in line or in_outputs_section:
            if 'new CfnOutput' in line:
                in_outputs_section = True
            if '});' in line:
                in_outputs_section = False
            continue
        
        clean_lines.append(line)
    
    # Ensure the constructor ends properly
    if clean_lines and clean_lines[-1].strip() != '}':
        # Find the last meaningful line and add proper closing
        while clean_lines and clean_lines[-1].strip() == '':
            clean_lines.pop()
        
        # Add proper constructor closing
        clean_lines.append('  }')
        clean_lines.append('}')
    
    # Write the cleaned file
    with open(file_path, 'w') as f:
        f.write('\n'.join(clean_lines))
    
    print("✅ File cleaned and syntax fixed")
    return True

if fix_cdk_syntax('cdk/lib/ehsshowchoir-stack.ts'):
    print("🔧 Syntax fix attempted")
else:
    print("❌ Could not fix automatically")
PYTHON_FIX

echo ""
echo "🔨 Testing the build..."
cd cdk
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful! Syntax error fixed."
    
    echo ""
    echo "🎯 Now adding the required outputs properly..."
    
    # Add the outputs in the correct location
    python3 << 'PYTHON_OUTPUTS'
import re

def add_outputs_safely(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # The outputs to add
    outputs = '''
    // Required outputs for frontend deployment
    new CfnOutput(this, 'WebsiteBucketName', {
      value: this.websiteBucket ? this.websiteBucket.bucketName : 'ehsshowchoir-website-bucket',
      description: 'Website S3 Bucket Name'
    });

    new CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution ? this.distribution.distributionId : 'MISSING_DISTRIBUTION',
      description: 'CloudFront Distribution ID'
    });

    new CfnOutput(this, 'ApiUrl', {
      value: this.api ? this.api.url : 'MISSING_API',
      description: 'API Gateway URL'
    });

    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool ? this.userPool.userPoolId : 'MISSING_USER_POOL',
      description: 'Cognito User Pool ID'
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient ? this.userPoolClient.userPoolClientId : 'MISSING_CLIENT',
      description: 'Cognito User Pool Client ID'
    });

    new CfnOutput(this, 'CognitoDomain', {
      value: this.userPoolDomain ? this.userPoolDomain.domainName : 'MISSING_DOMAIN',
      description: 'Cognito Domain'
    });'''
    
    # Find the constructor end and insert before it
    lines = content.split('\n')
    
    # Find the last meaningful closing brace of the constructor
    constructor_end = -1
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].strip() == '}' and i > 0 and 'export' not in lines[i-1:i+1]:
            constructor_end = i
            break
    
    if constructor_end > -1:
        # Insert outputs before the constructor closing brace
        lines.insert(constructor_end, outputs)
        
        # Write back
        with open(file_path, 'w') as f:
            f.write('\n'.join(lines))
        
        print("✅ Outputs added successfully")
        return True
    else:
        print("❌ Could not find insertion point")
        return False

add_outputs_safely('lib/ehsshowchoir-stack.ts')
PYTHON_OUTPUTS

    # Make sure CfnOutput is imported
    if ! grep -q "CfnOutput" lib/ehsshowchoir-stack.ts; then
        echo "📦 Adding CfnOutput import..."
        sed -i.tmp 's/import { Stack, StackProps } from '\''aws-cdk-lib'\'';/import { Stack, StackProps, CfnOutput } from '\''aws-cdk-lib'\'';/' lib/ehsshowchoir-stack.ts
        rm -f lib/ehsshowchoir-stack.ts.tmp
    fi
    
    echo ""
    echo "🔨 Testing build with outputs..."
    npm run build
    
    if [ $? -eq 0 ]; then
        echo "✅ Build successful with outputs!"
        
        echo ""
        echo "📡 Deploying with outputs file..."
        npx cdk deploy --outputs-file ../stack-outputs.json --require-approval never
        
        if [ $? -eq 0 ]; then
            echo "✅ Deployment successful!"
            
            cd ..
            echo ""
            echo "🔍 Checking for stack-outputs.json..."
            if [ -f "stack-outputs.json" ]; then
                echo "✅ stack-outputs.json created!"
                echo "📄 Contents:"
                cat stack-outputs.json
                
                echo ""
                echo "🌐 Testing frontend deployment..."
                ./scripts/deploy-frontend.sh
            else
                echo "❌ stack-outputs.json not found, creating manually..."
                # Create it manually
                aws cloudformation describe-stacks --stack-name EhsShowchoirStack --region us-east-2 \
                    --query 'Stacks[0].Outputs' --output json > raw-outputs.json
                
                echo '{"EhsShowchoirStack":{' > stack-outputs.json
                if command -v jq >/dev/null 2>&1; then
                    jq -r '.[] | "\"" + .OutputKey + "\":\"" + .OutputValue + "\","' raw-outputs.json | sed '$ s/,$//' >> stack-outputs.json
                fi
                echo '}}' >> stack-outputs.json
                
                rm -f raw-outputs.json
                echo "✅ Manual stack-outputs.json created"
                ./scripts/deploy-frontend.sh
            fi
        fi
    else
        echo "❌ Build failed with outputs"
    fi
else
    echo "❌ Initial build failed. Manual intervention needed."
    echo ""
    echo "📋 Manual steps to fix:"
    echo "1. Look at the syntax error around line 563"
    echo "2. Ensure all opening braces { have matching closing braces }"
    echo "3. Remove any incomplete CfnOutput statements"
    echo "4. Restore from backup if needed: cp $BACKUP_FILE $STACK_FILE"
fi

cd ..
echo ""
echo "📝 Summary:"
echo "- Backup saved: $BACKUP_FILE"
echo "- Run this script again after manual fixes if needed"
