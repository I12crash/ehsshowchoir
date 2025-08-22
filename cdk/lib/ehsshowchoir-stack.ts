import { Stack, StackProps, CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ses from 'aws-cdk-lib/aws-ses';

export class EhsShowchoirStack extends Stack {
  public readonly websiteBucket: s3.Bucket;
  public readonly invoicesBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;
  public readonly api: apigateway.RestApi;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;
  public readonly studentsTable: dynamodb.Table;
  public readonly paymentHistoryTable: dynamodb.Table;
  public readonly parentStudentTable: dynamodb.Table;
  public readonly invoiceLogTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const domainName = 'edgewoodshowchoirpayments.org';

    // ==========================================
    // S3 BUCKETS
    // ==========================================

    // Website hosting bucket
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: 'ehsshowchoir-website-bucket',
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Invoices storage bucket
    this.invoicesBucket = new s3.Bucket(this, 'InvoicesBucket', {
      bucketName: 'ehsshowchoir-invoices',
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
    });

// ==========================================
    // CLOUDFRONT DISTRIBUTION (WITHOUT SSL)
    // ==========================================

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.websiteBucket),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      comment: 'EHS Show Choir Payment System Distribution (No Custom Domain)',
    });

    // ==========================================
    // DYNAMODB TABLES
    // ==========================================

    // Students table
    this.studentsTable = new dynamodb.Table(this, 'StudentsTable', {
      tableName: 'ehsshowchoir-students',
      partitionKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    // Payment history table
    this.paymentHistoryTable = new dynamodb.Table(this, 'PaymentHistoryTable', {
      tableName: 'ehsshowchoir-payment-history',
      partitionKey: { name: 'paymentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
    });

    // Parent-student relationships table
    this.parentStudentTable = new dynamodb.Table(this, 'ParentStudentTable', {
      tableName: 'ehsshowchoir-parent-student-relationships',
      partitionKey: { name: 'parentEmail', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'studentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Invoice log table
    this.invoiceLogTable = new dynamodb.Table(this, 'InvoiceLogTable', {
      tableName: 'ehsshowchoir-invoice-log',
      partitionKey: { name: 'invoiceId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // ==========================================
    // COGNITO USER POOL
    // ==========================================

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'ehsshowchoir-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
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
      autoVerify: {
        email: true,
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    this.userPoolDomain = new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: 'ehsshowchoir-auth',
      },
    });

    // ==========================================
    // IAM ROLE FOR LAMBDA
    // ==========================================

    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        DynamoDBAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'dynamodb:GetItem',
                'dynamodb:PutItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
              ],
              resources: [
                this.studentsTable.tableArn,
                this.paymentHistoryTable.tableArn,
                this.parentStudentTable.tableArn,
                this.invoiceLogTable.tableArn,
              ],
            }),
          ],
        }),
        S3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
              ],
              resources: [
                `${this.invoicesBucket.bucketArn}/*`,
              ],
            }),
          ],
        }),
        SESAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'ses:SendEmail',
                'ses:SendRawEmail',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // ==========================================
    // LAMBDA FUNCTIONS
    // ==========================================

    // Students API Lambda
    const studentsLambda = new lambda.Function(this, 'StudentsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Students API called:', JSON.stringify(event, null, 2));
          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
            },
            body: JSON.stringify({
              message: 'Students API - Implementation needed',
              event: event
            }),
          };
        };
      `),
      role: lambdaRole,
      timeout: Duration.seconds(30),
    });

    // Payments API Lambda
    const paymentsLambda = new lambda.Function(this, 'PaymentsLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Payments API called:', JSON.stringify(event, null, 2));
          return {
            statusCode: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
            },
            body: JSON.stringify({
              message: 'Payments API - Implementation needed',
              event: event
            }),
          };
        };
      `),
      role: lambdaRole,
      timeout: Duration.seconds(30),
    });

    // ==========================================
    // API GATEWAY
    // ==========================================

    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'EHS Show Choir API',
      description: 'API for EHS Show Choir Payment System',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Students API endpoints
    const studentsResource = this.api.root.addResource('students');
    studentsResource.addMethod('GET', new apigateway.LambdaIntegration(studentsLambda));
    studentsResource.addMethod('POST', new apigateway.LambdaIntegration(studentsLambda));

    const studentResource = studentsResource.addResource('{studentId}');
    studentResource.addMethod('GET', new apigateway.LambdaIntegration(studentsLambda));
    studentResource.addMethod('PUT', new apigateway.LambdaIntegration(studentsLambda));
    studentResource.addMethod('DELETE', new apigateway.LambdaIntegration(studentsLambda));

    // Payments API endpoints
    const paymentsResource = this.api.root.addResource('payments');
    paymentsResource.addMethod('GET', new apigateway.LambdaIntegration(paymentsLambda));
    paymentsResource.addMethod('POST', new apigateway.LambdaIntegration(paymentsLambda));

    // ==========================================
    // SES EMAIL CONFIGURATION
    // ==========================================

    new ses.EmailIdentity(this, 'EmailIdentity', {
      identity: ses.Identity.domain(domainName),
    });

    // Create configuration set for tracking
    new ses.ConfigurationSet(this, 'ConfigurationSet', {
      configurationSetName: 'ehsshowchoir-emails',
    });

    // ==========================================
    // REQUIRED OUTPUTS FOR FRONTEND DEPLOYMENT
    // ==========================================

    new CfnOutput(this, 'WebsiteBucketName', {
      value: this.websiteBucket.bucketName,
      description: 'Website S3 Bucket Name',
      exportName: 'EhsShowchoir-WebsiteBucketName'
    });

    new CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: 'EhsShowchoir-CloudFrontDistributionId'
    });

    new CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: 'EhsShowchoir-ApiUrl'
    });

    new CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'EhsShowchoir-UserPoolId'
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'EhsShowchoir-UserPoolClientId'
    });

    new CfnOutput(this, 'CognitoDomain', {
      value: `https://${this.userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito Domain URL',
      exportName: 'EhsShowchoir-CognitoDomain'
    });

    new CfnOutput(this, 'WebsiteUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront Website URL (temporary)',
      exportName: 'EhsShowchoir-WebsiteUrl'
    });

    new CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
      exportName: 'EhsShowchoir-CloudFrontUrl'
    });

    new CfnOutput(this, 'Region', {
      value: this.region,
      description: 'AWS Region',
      exportName: 'EhsShowchoir-Region'
    });

    new CfnOutput(this, 'StackName', {
      value: this.stackName,
      description: 'CloudFormation Stack Name',
      exportName: 'EhsShowchoir-StackName'
    });
  }
}