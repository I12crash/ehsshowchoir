import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayIntegrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface FosterDevStackProps extends cdk.StackProps {
  hostedUiPrefix: string;
}

export class FosterDevStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FosterDevStackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const studentsTable = new dynamodb.Table(this, 'StudentsTable', {
      tableName: 'choir-students',
      partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const transactionsTable = new dynamodb.Table(this, 'TransactionsTable', {
      tableName: 'choir-transactions',
      partitionKey: { name: 'transactionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const parentsTable = new dynamodb.Table(this, 'ParentsTable', {
      tableName: 'choir-parents',
      partitionKey: { name: 'parentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

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

    // CloudFront Distribution - Using S3Origin (deprecated but works)
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

    // Lambda Function with DynamoDB permissions
    const apiHandler = new nodejs.NodejsFunction(this, 'ApiHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/api.ts'),
      environment: {
        UPLOADS_BUCKET: uploadsBucket.bucketName,
        STUDENTS_TABLE: studentsTable.tableName,
        TRANSACTIONS_TABLE: transactionsTable.tableName,
        PARENTS_TABLE: parentsTable.tableName,
        REGION: this.region,
        ADMIN_EMAIL: 'showchoirtreasurer@gmail.com',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      bundling: {
        externalModules: ['aws-sdk'],
        nodeModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/lib-dynamodb',
          '@aws-sdk/client-ses',
          '@aws-sdk/client-s3',
          'uuid',
        ],
        minify: false,
        sourceMap: true,
        target: 'node18',
      },
    });

    // Grant permissions to Lambda
    uploadsBucket.grantReadWrite(apiHandler);
    studentsTable.grantReadWriteData(apiHandler);
    transactionsTable.grantReadWriteData(apiHandler);
    parentsTable.grantReadWriteData(apiHandler);

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

    // API Routes - simplified to catch all
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigateway.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    // Also add root path
    httpApi.addRoutes({
      path: '/',
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
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
    });

    new cdk.CfnOutput(this, 'SiteBucketName', {
      value: siteBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.url!,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: `${props.hostedUiPrefix}.auth.${this.region}.amazoncognito.com`,
    });

    // Output table names for verification
    new cdk.CfnOutput(this, 'StudentsTableName', {
      value: studentsTable.tableName,
    });

    new cdk.CfnOutput(this, 'ParentsTableName', {
      value: parentsTable.tableName,
    });

    new cdk.CfnOutput(this, 'TransactionsTableName', {
      value: transactionsTable.tableName,
    });
  }
}
