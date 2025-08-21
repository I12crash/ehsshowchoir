#!/bin/bash
set -e

REGION=${AWS_REGION:-us-east-2}
HOSTED_UI_PREFIX=${HOSTED_UI_PREFIX:-foster-dev-auth}

echo "Deploying infrastructure to region $REGION..."
echo "Cognito Hosted UI prefix: $HOSTED_UI_PREFIX"

cd cdk
npm run build

# Deploy the stack
HOSTED_UI_PREFIX=$HOSTED_UI_PREFIX npx cdk deploy \
  --require-approval never \
  --outputs-file ../stack-outputs-raw.json

# Process outputs to create clean JSON
cd ..
node -e "
const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('stack-outputs-raw.json'));
const outputs = raw.FosterDevStack;
const clean = {};
for (const [key, value] of Object.entries(outputs)) {
  clean[key] = value;
}
fs.writeFileSync('stack-outputs.json', JSON.stringify(clean, null, 2));
fs.unlinkSync('stack-outputs-raw.json');
console.log('Stack outputs written to stack-outputs.json');
"

# Generate frontend .env file
node -e "
const fs = require('fs');
const outputs = JSON.parse(fs.readFileSync('stack-outputs.json'));
const envContent = \`VITE_API_URL=\${outputs.ApiUrl}
VITE_COGNITO_USER_POOL_ID=\${outputs.UserPoolId}
VITE_COGNITO_CLIENT_ID=\${outputs.UserPoolClientId}
VITE_COGNITO_DOMAIN=\${outputs.CognitoDomain}
VITE_CALLBACK_URL=https://\${outputs.CloudFrontDomainName}/callback
\`;
fs.writeFileSync('frontend/.env', envContent);
console.log('Frontend .env file generated');
"

echo "Infrastructure deployment complete!"
echo "CloudFront URL: $(cat stack-outputs.json | grep CloudFrontURL | cut -d'"' -f4)"
