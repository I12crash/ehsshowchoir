import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaBase from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';

export class CoreStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, 'ParentsPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: { email: { required: true, mutable: false } },
      passwordPolicy: { minLength: 8, requireDigits: true, requireLowercase: true, requireUppercase: false, requireSymbols: false },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const client = new cognito.UserPoolClient(this, 'WebClient', {
      userPool,
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true, implicitCodeGrant: true },
        callbackUrls: ['http://localhost:5173/callback', 'https://example.com/callback'],
        logoutUrls: ['http://localhost:5173/', 'https://example.com/'],
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    });

    const domain = new cognito.UserPoolDomain(this, 'Domain', {
      userPool,
      cognitoDomain: { domainPrefix: 'edgewood-choir-billing-test' },
    });

    const table = new dynamodb.Table(this, 'LedgerTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    const distro = new cloudfront.Distribution(this, 'SiteDistro', {
      defaultBehavior: { origin: new origins.S3Origin(siteBucket) },
      defaultRootObject: 'index.html',
    });

    const commonEnv = {
      TABLE_NAME: table.tableName,
      USER_POOL_ID: userPool.userPoolId,
      UPLOADS_BUCKET: uploadsBucket.bucketName,
      DEFAULT_SEASON: '2025-2026',
      TREASURER_EMAIL: 'showchoirtreasurer@gmail.com',
      SANDBOX_PARENT_SUB: 'TEST-PARENT',
    };

    const bundling: lambda.BundlingOptions = {
      minify: true,
      target: 'node20',
      externalModules: ['aws-sdk'],
      nodeModules: [
        '@aws-sdk/client-dynamodb',
        '@aws-sdk/util-dynamodb',
        '@aws-sdk/client-sesv2',
        '@aws-sdk/client-s3',
        'exceljs',
      ],
      forceDockerBundling: true,
    };

    const getInvoiceFn = new lambda.NodejsFunction(this, 'GetInvoiceFn', {
      entry: 'lambda/get-invoice.ts',
      runtime: lambdaBase.Runtime.NODEJS_20_X,
      bundling,
      environment: commonEnv,
      timeout: Duration.seconds(15),
      memorySize: 256,
    });
    table.grantReadData(getInvoiceFn);

    const contactFn = new lambda.NodejsFunction(this, 'ContactFn', {
      entry: 'lambda/contact-treasurer.ts',
      runtime: lambdaBase.Runtime.NODEJS_20_X,
      bundling,
      environment: commonEnv,
      timeout: Duration.seconds(15),
      memorySize: 256,
    });

    const adminListStudentsFn = new lambda.NodejsFunction(this, 'AdminListStudentsFn', {
      entry: 'lambda/admin-list-students.ts',
      runtime: lambdaBase.Runtime.NODEJS_20_X,
      bundling,
      environment: commonEnv,
      timeout: Duration.seconds(15),
      memorySize: 256,
    });

    const uploadEtlFn = new lambda.NodejsFunction(this, 'AdminUploadLedgerFn', {
      entry: 'lambda/admin-upload-ledger.ts',
      runtime: lambdaBase.Runtime.NODEJS_20_X,
      bundling,
      environment: commonEnv,
      timeout: Duration.seconds(60),
      memorySize: 1024,
    });
    uploadsBucket.grantRead(uploadEtlFn);
    table.grantReadWriteData(uploadEtlFn);

    uploadsBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(uploadEtlFn));

    contactFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendTemplatedEmail'],
      resources: ['*'],
    }));

    const httpApi = new apigwv2.HttpApi(this, 'Api', {
      corsPreflight: {
        allowHeaders: ['Authorization','Content-Type'],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.OPTIONS],
        allowOrigins: ['*'],
      }
    });
    httpApi.addRoutes({ path: '/me/invoice', methods: [apigwv2.HttpMethod.GET], integration: new integrations.HttpLambdaIntegration('GetInvoiceInt', getInvoiceFn) });
    httpApi.addRoutes({ path: '/contact/treasurer', methods: [apigwv2.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration('ContactInt', contactFn) });
    httpApi.addRoutes({ path: '/admin/students', methods: [apigwv2.HttpMethod.GET], integration: new integrations.HttpLambdaIntegration('AdminStudentsInt', adminListStudentsFn) });

    new CfnOutput(this, 'HostedUIDomain', { value: `https://${domain.domainName}` });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: client.userPoolClientId });
    new CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new CfnOutput(this, 'SiteBucketName', { value: siteBucket.bucketName });
    new CfnOutput(this, 'UploadsBucketName', { value: uploadsBucket.bucketName });
    new CfnOutput(this, 'CloudFrontDomain', { value: distro.domainName });
    new CfnOutput(this, 'CloudFrontDistributionId', { value: distro.distributionId });
  }
}
