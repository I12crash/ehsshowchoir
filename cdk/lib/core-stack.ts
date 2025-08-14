
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class CoreStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB
    const table = new dynamodb.Table(this, 'Table', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'TypeIndex',
      partitionKey: { name: 'TYPE', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'studentName', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Cognito
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      standardAttributes: { email: { required: true, mutable: false } },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      authFlows: { userSrp: true },
      oAuth: {
        flows: { implicitCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: ['http://localhost:5173/callback'],
        logoutUrls: ['http://localhost:5173/'],
      },
      generateSecret: false,
      preventUserExistenceErrors: true,
    });

    const hostedDomainPrefix = 'edgewood-choir-billing-test'; // change if desired
    const domain = userPool.addDomain('CognitoDomain', {
      cognitoDomain: { domainPrefix: hostedDomainPrefix }
    });

    // Lambdas (project root set to cdk/ so bundler finds package.json)
    const commonNodeOpts = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      projectRoot: path.join(__dirname, '..'),
      depsLockFilePath: path.join(__dirname, '..', 'package-lock.json'),
      bundling: {
        target: 'node20',
        externalModules: [],
        nodeModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/util-dynamodb',
          '@aws-sdk/client-sesv2',
          'exceljs',
          'uuid'
        ],
        minify: true,
        sourceMap: false,
      }
    };

    const envVars = {
      TABLE_NAME: table.tableName,
      ADMIN_EMAIL: 'showchoirtreasurer@gmail.com',
      READONLY_EMAILS: '', // comma separated
      REGION: cdk.Stack.of(this).region
    };

    const getInvoiceFn = new NodejsFunction(this, 'GetInvoiceFn', {
      entry: path.join(__dirname, '..', 'lambda', 'get-invoice.ts'),
      ...commonNodeOpts,
      environment: envVars
    });

    const contactTreasurerFn = new NodejsFunction(this, 'ContactTreasurerFn', {
      entry: path.join(__dirname, '..', 'lambda', 'contact-treasurer.ts'),
      ...commonNodeOpts,
      environment: envVars
    });

    const adminListStudentsFn = new NodejsFunction(this, 'AdminListStudentsFn', {
      entry: path.join(__dirname, '..', 'lambda', 'admin-list-students.ts'),
      ...commonNodeOpts,
      environment: envVars
    });

    const adminUpsertStudentFn = new NodejsFunction(this, 'AdminUpsertStudentFn', {
      entry: path.join(__dirname, '..', 'lambda', 'admin-upsert-student.ts'),
      ...commonNodeOpts,
      environment: envVars
    });

    const adminDeleteStudentFn = new NodejsFunction(this, 'AdminDeleteStudentFn', {
      entry: path.join(__dirname, '..', 'lambda', 'admin-delete-student.ts'),
      ...commonNodeOpts,
      environment: envVars
    });

    const adminTransactionFn = new NodejsFunction(this, 'AdminTransactionFn', {
      entry: path.join(__dirname, '..', 'lambda', 'admin-transaction.ts'),
      ...commonNodeOpts,
      environment: envVars
    });

    const adminBatchChargeFn = new NodejsFunction(this, 'AdminBatchChargeFn', {
      entry: path.join(__dirname, '..', 'lambda', 'admin-batch-charge.ts'),
      ...commonNodeOpts,
      environment: envVars
    });

    const adminParentLinkFn = new NodejsFunction(this, 'AdminParentLinkFn', {
      entry: path.join(__dirname, '..', 'lambda', 'admin-parent-link.ts'),
      ...commonNodeOpts,
      environment: envVars
    });

    table.grantReadWriteData(getInvoiceFn);
    table.grantReadWriteData(contactTreasurerFn);
    table.grantReadWriteData(adminListStudentsFn);
    table.grantReadWriteData(adminUpsertStudentFn);
    table.grantReadWriteData(adminDeleteStudentFn);
    table.grantReadWriteData(adminTransactionFn);
    table.grantReadWriteData(adminBatchChargeFn);
    table.grantReadWriteData(adminParentLinkFn);

    contactTreasurerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail','ses:SendRawEmail','ses:SendTemplatedEmail'],
      resources: ['*']
    }));

    // API Gateway (REST)
    const api = new apigw.RestApi(this, 'Api', {
      restApiName: 'ShowChoirBilling',
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['*']
      }
    });

    // Cognito authorizer for admin
    const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'AdminAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });

    // Routes
    const me = api.root.addResource('me');
    const invoice = me.addResource('invoice');
    invoice.addMethod('GET', new apigw.LambdaIntegration(getInvoiceFn));

    const admin = api.root.addResource('admin');
    const students = admin.addResource('students');
    students.addMethod('GET', new apigw.LambdaIntegration(adminListStudentsFn), {
      authorizer, authorizationType: apigw.AuthorizationType.COGNITO
    });
    students.addMethod('POST', new apigw.LambdaIntegration(adminUpsertStudentFn), {
      authorizer, authorizationType: apigw.AuthorizationType.COGNITO
    });
    const studentId = students.addResource('{studentId}');
    studentId.addMethod('DELETE', new apigw.LambdaIntegration(adminDeleteStudentFn), {
      authorizer, authorizationType: apigw.AuthorizationType.COGNITO
    });

    const txn = admin.addResource('transaction');
    txn.addMethod('POST', new apigw.LambdaIntegration(adminTransactionFn), {
      authorizer, authorizationType: apigw.AuthorizationType.COGNITO
    });

    const batch = admin.addResource('batch').addResource('charge');
    batch.addMethod('POST', new apigw.LambdaIntegration(adminBatchChargeFn), {
      authorizer, authorizationType: apigw.AuthorizationType.COGNITO
    });

    const parentLink = admin.addResource('parent-link');
    parentLink.addMethod('POST', new apigw.LambdaIntegration(adminParentLinkFn), {
      authorizer, authorizationType: apigw.AuthorizationType.COGNITO
    });

    // Static site hosting
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI');
    siteBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [siteBucket.arnForObjects('*')],
      principals: [new iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId)]
    }));

    const dist = new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: { origin: new origins.S3Origin(siteBucket, { originAccessIdentity: oai }) },
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ]
    });

    new cdk.CfnOutput(this, 'ApiBaseUrl', { value: api.url?.slice(0, -1) || '' });
    new cdk.CfnOutput(this, 'SiteBucketName', { value: siteBucket.bucketName });
    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: dist.distributionDomainName });
    new cdk.CfnOutput(this, 'CloudFrontDistributionId', { value: dist.distributionId });
    new cdk.CfnOutput(this, 'CognitoHostedDomain', { value: `${hostedDomainPrefix}.auth.${cdk.Stack.of(this).region}.amazoncognito.com` });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
  }
}
