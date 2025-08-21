#!/bin/bash
# Complete Foster.dev Project Setup Script
# Run this script to create the entire project structure

set -e

PROJECT_NAME="foster-dev-app"
echo "Creating $PROJECT_NAME project structure..."

# Create main project directory
mkdir -p $PROJECT_NAME
cd $PROJECT_NAME

# Create directory structure
mkdir -p cdk/bin cdk/lib cdk/lambda
mkdir -p frontend/src/components frontend/public
mkdir -p scripts

# ============================================
# ROOT FILES
# ============================================

cat > README.md << 'EOF'
# Foster.dev AWS Application

A full-stack AWS application with CDK infrastructure, React frontend, and Cognito authentication.

## Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with credentials
- AWS CDK CLI: `npm install -g aws-cdk`
- Valid AWS account with permissions for CloudFormation, S3, CloudFront, Lambda, API Gateway, Cognito

## Project Structure

```
.
├── cdk/                 # CDK infrastructure code
│   ├── lib/            # Stack definitions
│   ├── lambda/         # Lambda function source
│   └── bin/            # CDK app entry
├── frontend/           # React + Vite + Amplify frontend
│   ├── src/
│   └── public/
├── scripts/            # Deployment automation
├── README.md
└── package.json
```

## Quick Start

1. **Install Dependencies**
```bash
npm install
cd cdk && npm install && cd ..
cd frontend && npm install && cd ..
```

2. **Configure Environment**
```bash
export AWS_REGION=us-east-2
export HOSTED_UI_PREFIX=foster-dev-auth
```

3. **Bootstrap CDK** (first time only)
```bash
./scripts/bootstrap.sh
```

4. **Deploy Infrastructure**
```bash
./scripts/deploy-infra.sh
```

5. **Deploy Frontend**
```bash
./scripts/deploy-frontend.sh
```

6. **Access the Application**
- Check `stack-outputs.json` for CloudFront URL
- Or run: `cat stack-outputs.json | jq -r .CloudFrontDomainName`

## Domain Setup (edgewoodshowchoirpayments.org)

### ACM Certificate (us-east-1 for CloudFront)
1. The CDK stack creates a certificate request in us-east-1
2. Add the CNAME validation records to Squarespace DNS
3. Wait for validation to complete
4. Update CloudFront with the certificate

### DNS Configuration (Squarespace)
Add CNAME record:
- Host: `www` (or your chosen subdomain)
- Points to: CloudFront distribution domain (e.g., `d1234567890.cloudfront.net`)

## Authentication Setup

### Email/Password
Works out of the box with Cognito User Pool.

### Social Providers (Google/Facebook)
1. Create OAuth apps in Google/Facebook developer consoles
2. Add credentials to Cognito User Pool:
   - AWS Console → Cognito → User Pools → Your Pool
   - Sign-in experience → Federated identity providers
   - Add Google/Facebook with your app credentials
3. Update Hosted UI settings with callback URLs
4. Social sign-in buttons appear automatically in the frontend

### Admin User
To allow `showchoirtreasurer@gmail.com` to sign in:
- They can register with email/password
- Or sign in with Google once configured

## Useful Commands

### Infrastructure
```bash
# View stack outputs
cat stack-outputs.json | jq

# Get CloudFront URL
aws cloudformation describe-stacks --stack-name FosterDevStack \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
  --output text

# Test API health
curl $(cat stack-outputs.json | jq -r .ApiUrl)/health
```

### Troubleshooting
```bash
# Check CDK diff
cd cdk && npx cdk diff

# View Lambda logs
aws logs tail /aws/lambda/FosterDevStack-ApiHandler --follow

# Invalidate CloudFront cache
./scripts/invalidate-cache.sh
```

### Cleanup
```bash
# Destroy all resources
./scripts/destroy.sh
```

## Environment Variables

The frontend `.env` file is auto-generated from stack outputs:
- `VITE_API_URL` - API Gateway endpoint
- `VITE_COGNITO_USER_POOL_ID` - Cognito User Pool ID
- `VITE_COGNITO_CLIENT_ID` - Cognito app client ID
- `VITE_COGNITO_DOMAIN` - Cognito Hosted UI domain
- `VITE_CALLBACK_URL` - OAuth callback URL

## Security Notes

- Never commit `.env` files
- Rotate Cognito app client secrets regularly
- Use least-privilege IAM policies
- Enable CloudTrail for audit logging
- Consider WAF for CloudFront protection
EOF

cat > package.json << 'EOF'
{
  "name": "foster-dev-app",
  "version": "1.0.0",
  "description": "Foster.dev AWS Application",
  "private": true,
  "scripts": {
    "bootstrap": "./scripts/bootstrap.sh",
    "deploy:infra": "./scripts/deploy-infra.sh",
    "deploy:frontend": "./scripts/deploy-frontend.sh",
    "destroy": "./scripts/destroy.sh",
    "test": "cd cdk && npm test && cd ../frontend && npm test"
  },
  "workspaces": [
    "cdk",
    "frontend"
  ],
  "devDependencies": {
    "@types/node": "^20.10.0"
  }
}
EOF

cat > .gitignore << 'EOF'
node_modules/
*.js
!jest.config.js
*.d.ts
.env
.env.local
cdk.out/
dist/
build/
.DS_Store
*.log
stack-outputs.json
.vscode/
.idea/
*.swp
*.swo
EOF

# ============================================
# CDK INFRASTRUCTURE
# ============================================

cat > cdk/package.json << 'EOF'
{
  "name": "foster-dev-cdk",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "test": "jest",
    "cdk": "cdk"
  },
  "devDependencies": {
    "@types/jest": "^29.5.11",
    "@types/node": "^20.10.0",
    "aws-cdk": "^2.118.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.2",
    "typescript": "~5.3.3"
  },
  "dependencies": {
    "aws-cdk-lib": "^2.118.0",
    "constructs": "^10.3.0",
    "source-map-support": "^0.5.21",
    "@types/aws-lambda": "^8.10.130"
  }
}
EOF

cat > cdk/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["es2020"],
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": false,
    "inlineSourceMap": true,
    "inlineSources": true,
    "experimentalDecorators": true,
    "strictPropertyInitialization": false,
    "typeRoots": ["./node_modules/@types"],
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "exclude": ["node_modules", "cdk.out"]
}
EOF

cat > cdk/cdk.json << 'EOF'
{
  "app": "npx ts-node --prefer-ts-exts bin/foster-dev.ts",
  "watch": {
    "include": ["**"],
    "exclude": ["README.md", "cdk*.json", "**/*.d.ts", "**/*.js", "tsconfig.json", "package*.json", "yarn.lock", "node_modules", "test"]
  },
  "context": {
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "@aws-cdk/core:checkSecretUsage": true,
    "@aws-cdk/core:target-partitions": ["aws", "aws-cn"],
    "@aws-cdk-containers/ecs-service-extensions:enableDefaultLogDriver": true,
    "@aws-cdk/aws-ec2:uniqueImdsv2TemplateName": true,
    "@aws-cdk/aws-ecs:arnFormatIncludesClusterName": true,
    "@aws-cdk/aws-iam:minimizePolicies": true,
    "@aws-cdk/core:validateSnapshotRemovalPolicy": true,
    "@aws-cdk/aws-codepipeline:crossAccountKeyAliasStackSafeResourceName": true,
    "@aws-cdk/aws-s3:createDefaultLoggingPolicy": true,
    "@aws-cdk/aws-sns-subscriptions:restrictSqsDescryption": true,
    "@aws-cdk/aws-apigateway:disableCloudWatchRole": true,
    "@aws-cdk/core:enablePartitionLiterals": true,
    "@aws-cdk/aws-events:eventsTargetQueueSameAccount": true,
    "@aws-cdk/aws-iam:standardizedServicePrincipals": true,
    "@aws-cdk/aws-ecs:disableExplicitDeploymentControllerForCircuitBreaker": true
  }
}
EOF

cat > cdk/bin/foster-dev.ts << 'EOF'
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FosterDevStack } from '../lib/foster-dev-stack';

const app = new cdk.App();

const hostedUiPrefix = process.env.HOSTED_UI_PREFIX || 'foster-dev-auth';

new FosterDevStack(app, 'FosterDevStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-2',
  },
  hostedUiPrefix,
  crossRegionReferences: true,
});
EOF

cat > cdk/lib/foster-dev-stack.ts << 'EOF'
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface FosterDevStackProps extends cdk.StackProps {
  hostedUiPrefix: string;
}

export class FosterDevStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FosterDevStackProps) {
    super(scope, id, props);

    // S3 Buckets
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: `foster-dev-site-${this.account}-${this.region}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedHeaders: ['*'],
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
        allowedOrigins: ['*'],
        maxAge: 3000,
      }],
    });

    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `foster-dev-uploads-${this.account}-${this.region}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedHeaders: ['*'],
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST, s3.HttpMethods.DELETE],
        allowedOrigins: ['*'],
        maxAge: 3000,
      }],
    });

    // CloudFront Origin Access Identity
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI');
    siteBucket.grantRead(oai);

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket, {
          originAccessIdentity: oai,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    // Lambda Function
    const apiHandler = new nodejs.NodejsFunction(this, 'ApiHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/api.ts'),
      environment: {
        UPLOADS_BUCKET: uploadsBucket.bucketName,
        REGION: this.region,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      bundling: {
        externalModules: [],
        nodeModules: ['@aws-sdk/client-s3', '@aws-sdk/util-dynamodb'],
      },
    });

    uploadsBucket.grantReadWrite(apiHandler);

    // API Gateway HTTP API
    const httpApi = new apigateway.HttpApi(this, 'HttpApi', {
      apiName: 'foster-dev-api',
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: [
          apigateway.CorsHttpMethod.GET,
          apigateway.CorsHttpMethod.POST,
          apigateway.CorsHttpMethod.PUT,
          apigateway.CorsHttpMethod.DELETE,
          apigateway.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Lambda Integration
    const lambdaIntegration = new apigatewayIntegrations.HttpLambdaIntegration(
      'LambdaIntegration',
      apiHandler
    );

    // API Routes
    httpApi.addRoutes({
      path: '/health',
      methods: [apigateway.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigateway.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'foster-dev-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Cognito User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: 'foster-dev-web-client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          `https://${distribution.distributionDomainName}/callback`,
          'http://localhost:5173/callback',
        ],
        logoutUrls: [
          `https://${distribution.distributionDomainName}`,
          'http://localhost:5173',
        ],
      },
    });

    // Cognito Domain for Hosted UI
    const cognitoDomain = new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool,
      cognitoDomain: {
        domainPrefix: props.hostedUiPrefix,
      },
    });

    // Stack Outputs
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'SiteBucketName', {
      value: siteBucket.bucketName,
      description: 'Site S3 Bucket Name',
    });

    new cdk.CfnOutput(this, 'UploadsBucketName', {
      value: uploadsBucket.bucketName,
      description: 'Uploads S3 Bucket Name',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.url!,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: `${props.hostedUiPrefix}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito Hosted UI Domain',
    });
  }
}
EOF

cat > cdk/lambda/api.ts << 'EOF'
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.REGION });

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const path = event.rawPath;
  const method = event.requestContext.http.method;

  // Health check endpoint
  if (path === '/health' && method === 'GET') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        region: process.env.REGION,
      }),
    };
  }

  // List uploads endpoint
  if (path === '/uploads' && method === 'GET') {
    try {
      const command = new ListObjectsV2Command({
        Bucket: process.env.UPLOADS_BUCKET,
        MaxKeys: 100,
      });
      const response = await s3Client.send(command);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          files: response.Contents || [],
        }),
      };
    } catch (error) {
      console.error('Error listing uploads:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Failed to list uploads',
        }),
      };
    }
  }

  // Default response
  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      message: 'Not Found',
      path,
      method,
    }),
  };
};
EOF

# ============================================
# FRONTEND
# ============================================

cat > frontend/package.json << 'EOF'
{
  "name": "foster-dev-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "@aws-amplify/ui-react": "^6.0.0",
    "aws-amplify": "^6.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
EOF

cat > frontend/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF

cat > frontend/tsconfig.node.json << 'EOF'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
EOF

cat > frontend/vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      './runtimeConfig': './runtimeConfig.browser',
    },
  },
  define: {
    global: 'window',
  },
})
EOF

cat > frontend/.eslintrc.cjs << 'EOF'
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}
EOF

cat > frontend/index.html << 'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Foster.dev</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
EOF

cat > frontend/public/vite.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="31.88" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 257"><defs><linearGradient id="IconifyId1813088fe1fbc01fb466" x1="-.828%" x2="57.636%" y1="7.652%" y2="78.411%"><stop offset="0%" stop-color="#41D1FF"></stop><stop offset="100%" stop-color="#BD34FE"></stop></linearGradient><linearGradient id="IconifyId1813088fe1fbc01fb467" x1="43.376%" x2="50.316%" y1="2.242%" y2="89.03%"><stop offset="0%" stop-color="#FFEA83"></stop><stop offset="8.333%" stop-color="#FFDD35"></stop><stop offset="100%" stop-color="#FFA800"></stop></linearGradient></defs><path fill="url(#IconifyId1813088fe1fbc01fb466)" d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.814 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62Z"></path><path fill="url(#IconifyId1813088fe1fbc01fb467)" d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028l72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.769-4.113Z"></path></svg>
EOF

cat > frontend/src/amplify.ts << 'EOF'
import { Amplify } from 'aws-amplify';

const config = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      signUpVerificationMethod: 'code' as const,
      loginWith: {
        email: true,
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN,
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: [import.meta.env.VITE_CALLBACK_URL],
          redirectSignOut: [import.meta.env.VITE_CALLBACK_URL?.replace('/callback', '')],
          responseType: 'code' as const,
        },
      },
    },
  },
  API: {
    REST: {
      FosterAPI: {
        endpoint: import.meta.env.VITE_API_URL,
      },
    },
  },
};

Amplify.configure(config);
EOF

cat > frontend/src/main.tsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './amplify';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
EOF

cat > frontend/src/App.tsx << 'EOF'
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import Dashboard from './components/Dashboard';
import Callback from './components/Callback';
import './App.css';

function App() {
  return (
    <Router>
      <Authenticator>
        <Routes>
          <Route path="/callback" element={<Callback />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<AuthenticatedRoute />} />
        </Routes>
      </Authenticator>
    </Router>
  );
}

function AuthenticatedRoute() {
  const { user } = useAuthenticator((context) => [context.user]);
  return user ? <Navigate to="/dashboard" /> : <div>Loading...</div>;
}

export default App;
EOF

cat > frontend/src/components/Dashboard.tsx << 'EOF'
import { useState, useEffect } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { get } from 'aws-amplify/api';

export default function Dashboard() {
  const { user, signOut } = useAuthenticator((context) => [context.user]);
  const [apiHealth, setApiHealth] = useState<string>('Checking...');
  const [uploads, setUploads] = useState<any[]>([]);

  useEffect(() => {
    checkApiHealth();
    fetchUploads();
  }, []);

  const checkApiHealth = async () => {
    try {
      const restOperation = get({
        apiName: 'FosterAPI',
        path: '/health',
      });
      const response = await restOperation.response;
      const data = await response.body.json();
      setApiHealth(data.status || 'Connected');
    } catch (error) {
      console.error('API Health check failed:', error);
      setApiHealth('Error');
    }
  };

  const fetchUploads = async () => {
    try {
      const restOperation = get({
        apiName: 'FosterAPI',
        path: '/uploads',
      });
      const response = await restOperation.response;
      const data = await response.body.json();
      setUploads(data.files || []);
    } catch (error) {
      console.error('Failed to fetch uploads:', error);
    }
  };

  return (
    <div className="dashboard">
      <header>
        <h1>Foster.dev Dashboard</h1>
        <button onClick={signOut}>Sign Out</button>
      </header>
      
      <main>
        <section className="user-info">
          <h2>Welcome!</h2>
          <p>Email: {user?.signInDetails?.loginId}</p>
        </section>

        <section className="api-status">
          <h2>API Status</h2>
          <p>Health: <span className={`status ${apiHealth.toLowerCase()}`}>{apiHealth}</span></p>
        </section>

        <section className="uploads">
          <h2>Recent Uploads</h2>
          {uploads.length > 0 ? (
            <ul>
              {uploads.map((file: any, index: number) => (
                <li key={index}>{file.Key} - {file.Size} bytes</li>
              ))}
            </ul>
          ) : (
            <p>No uploads yet</p>
          )}
        </section>
      </main>
    </div>
  );
}
EOF

cat > frontend/src/components/Callback.tsx << 'EOF'
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle OAuth callback
    setTimeout(() => {
      navigate('/dashboard');
    }, 1000);
  }, [navigate]);

  return (
    <div className="callback">
      <h2>Completing sign in...</h2>
    </div>
  );
}
EOF

cat > frontend/src/index.css << 'EOF'
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

h1 {
  font-size: 3.2em;
  line-height: 1.1;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #646cff;
}

button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }
  button {
    background-color: #f9f9f9;
  }
}
EOF

cat > frontend/src/App.css << 'EOF'
#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
  width: 100%;
}

.dashboard {
  text-align: left;
}

.dashboard header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #333;
}

.dashboard section {
  margin-bottom: 2rem;
  padding: 1rem;
  border: 1px solid #333;
  border-radius: 8px;
}

.status {
  font-weight: bold;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.status.healthy {
  background-color: #4caf50;
  color: white;
}

.status.error {
  background-color: #f44336;
  color: white;
}

.status.checking {
  background-color: #ff9800;
  color: white;
}

.callback {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
}
EOF

cat > frontend/src/vite-env.d.ts << 'EOF'
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_COGNITO_USER_POOL_ID: string
  readonly VITE_COGNITO_CLIENT_ID: string
  readonly VITE_COGNITO_DOMAIN: string
  readonly VITE_CALLBACK_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
EOF

# ============================================
# DEPLOYMENT SCRIPTS
# ============================================

cat > scripts/bootstrap.sh << 'EOF'
#!/bin/bash
set -e

REGION=${AWS_REGION:-us-east-2}
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)

echo "Bootstrapping CDK for account $ACCOUNT in region $REGION..."

cd cdk
npx cdk bootstrap aws://$ACCOUNT/$REGION

echo "CDK bootstrap complete!"
EOF

cat > scripts/deploy-infra.sh << 'EOF'
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
EOF

cat > scripts/deploy-frontend.sh << 'EOF'
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
EOF

cat > scripts/destroy.sh << 'EOF'
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
EOF

cat > scripts/invalidate-cache.sh << 'EOF'
#!/bin/bash
set -e

if [ ! -f "stack-outputs.json" ]; then
  echo "Error: stack-outputs.json not found. Run deploy-infra.sh first."
  exit 1
fi

DISTRIBUTION_ID=$(cat stack-outputs.json | grep CloudFrontDistributionId | cut -d'"' -f4)

echo "Invalidating CloudFront distribution: $DISTRIBUTION_ID"
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text

echo "Cache invalidation initiated!"
EOF

# Make scripts executable
chmod +x scripts/*.sh

echo "✅ Project structure created successfully!"
echo ""
echo "Next steps:"
echo "1. cd $PROJECT_NAME"
echo "2. npm install"
echo "3. cd cdk && npm install && cd .."
echo "4. cd frontend && npm install && cd .."
echo "5. export AWS_REGION=us-east-2"
echo "6. export HOSTED_UI_PREFIX=foster-dev-auth"
echo "7. ./scripts/bootstrap.sh (first time only)"
echo "8. ./scripts/deploy-infra.sh"
echo "9. ./scripts/deploy-frontend.sh"
echo ""
echo "The application will be available at the CloudFront URL shown in the output."
