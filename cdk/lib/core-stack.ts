import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as iam from 'aws-cdk-lib/aws-iam';

export class CoreStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Cognito User Pool + Client (Hosted UI)
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
        flows: { authorizationCodeGrant: true },
        callbackUrls: ['http://localhost:5173/callback', 'https://example.com/callback'],
        logoutUrls: ['http://localhost:5173/', 'https://example.com/'],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        // Later: GOOGLE, FACEBOOK via identity providers
      ],
    });

    const domain = new cognito.UserPoolDomain(this, 'Domain', {
      userPool,
      cognitoDomain: { domainPrefix: 'edgewood-choir-billing-test' },
    });

    // DynamoDB table (single-table pattern)
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

    // Buckets
    const siteBucket = new s3.Bucket(this, 'SiteBucket', { websiteIndexDocument: 'index.html', publicReadAccess: false });
    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false
    });

    // CloudFront for static site
    const distro = new cloudfront.Distribution(this, 'SiteDistro', {
      defaultBehavior: { origin: new origins.S3Origin(siteBucket) }
    });

    // Lambdas env
    const commonEnv = {
      TABLE_NAME: table.tableName,
      USER_POOL_ID: userPool.userPoolId,
      UPLOADS_BUCKET: uploadsBucket.bucketName,
      DEFAULT_SEASON: '2025-2026'
    };

    const getInvoiceFn = new lambda.NodejsFunction(this, 'GetInvoiceFn', {
      entry: 'lambda/get-invoice.ts',
      bundling: { minify: true, externalModules: [], },
      environment: commonEnv,
    });
    table.grantReadData(getInvoiceFn);

    const contactFn = new lambda.NodejsFunction(this, 'ContactFn', {
      entry: 'lambda/contact-treasurer.ts',
      bundling: { minify: true, externalModules: [], },
      environment: commonEnv
    });

    const uploadEtlFn = new lambda.NodejsFunction(this, 'AdminUploadLedgerFn', {
      entry: 'lambda/admin-upload-ledger.ts',
      timeout: Duration.seconds(60),
      memorySize: 1024,
      bundling: { minify: true },
      environment: commonEnv,
    });
    uploadsBucket.grantRead(uploadEtlFn);
    table.grantReadWriteData(uploadEtlFn);

    // S3 event -> ETL
    uploadsBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(uploadEtlFn));

    // HTTP API (no payments routes for now)
    const httpApi = new apigwv2.HttpApi(this, 'Api');
    httpApi.addRoutes({ path: '/me/invoice', methods: [apigwv2.HttpMethod.GET], integration: new integrations.HttpLambdaIntegration('GetInvoiceInt', getInvoiceFn) });
    httpApi.addRoutes({ path: '/contact/treasurer', methods: [apigwv2.HttpMethod.POST], integration: new integrations.HttpLambdaIntegration('ContactInt', contactFn) });

    // Permissions for SES send
    contactFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendTemplatedEmail'],
      resources: ['*']
    }));

    // Outputs
    new CfnOutput(this, 'HostedUIDomain', { value: domain.domainName });
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: client.userPoolClientId });
    new CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new CfnOutput(this, 'SiteBucketName', { value: siteBucket.bucketName });
    new CfnOutput(this, 'UploadsBucketName', { value: uploadsBucket.bucketName });
    new CfnOutput(this, 'CloudFrontDomain', { value: distro.domainName });
  }
}
