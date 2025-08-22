"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EhsShowchoirStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const certificatemanager = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const ses = __importStar(require("aws-cdk-lib/aws-ses"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class EhsShowchoirStack extends cdk.Stack {
    constructor(scope, id, props = {}) {
        super(scope, id, props);
        const domainName = props.domainName || 'edgewoodshowchoirpayments.org';
        // ==========================================
        // S3 BUCKETS
        // ==========================================
        // Website hosting bucket
        const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
            bucketName: `ehsshowchoir-website-${this.account}-${this.region}`,
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            versioned: true,
            lifecycleRules: [
                {
                    id: 'DeleteOldVersions',
                    noncurrentVersionExpiration: cdk.Duration.days(30),
                    enabled: true,
                },
            ],
        });
        // Invoice storage bucket
        const invoicesBucket = new s3.Bucket(this, 'InvoicesBucket', {
            bucketName: `ehsshowchoir-invoices-${this.account}-${this.region}`,
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            versioned: true,
            lifecycleRules: [
                {
                    id: 'ArchiveOldInvoices',
                    transitions: [
                        {
                            storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                            transitionAfter: cdk.Duration.days(90),
                        },
                        {
                            storageClass: s3.StorageClass.GLACIER,
                            transitionAfter: cdk.Duration.days(365),
                        },
                    ],
                    enabled: true,
                },
                {
                    id: 'DeleteVeryOldInvoices',
                    expiration: cdk.Duration.days(2555),
                    enabled: true,
                },
            ],
        });
        // ==========================================
        // DYNAMODB TABLES
        // ==========================================
        // Students table
        const studentsTable = new dynamodb.Table(this, 'StudentsTable', {
            tableName: 'ehsshowchoir-students',
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
        });
        // Add GSI for parent email lookups
        studentsTable.addGlobalSecondaryIndex({
            indexName: 'ParentEmailIndex',
            partitionKey: { name: 'parentEmail', type: dynamodb.AttributeType.STRING },
        });
        // Add GSI for status filtering
        studentsTable.addGlobalSecondaryIndex({
            indexName: 'StatusIndex',
            partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
        });
        // Payment history table
        const paymentHistoryTable = new dynamodb.Table(this, 'PaymentHistoryTable', {
            tableName: 'ehsshowchoir-payment-history',
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'transaction_date', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            pointInTimeRecovery: true,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
        });
        // Add GSI for student lookups
        paymentHistoryTable.addGlobalSecondaryIndex({
            indexName: 'StudentIdIndex',
            partitionKey: { name: 'student_id', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'transaction_date', type: dynamodb.AttributeType.STRING },
        });
        // Add GSI for parent email lookups
        paymentHistoryTable.addGlobalSecondaryIndex({
            indexName: 'ParentEmailIndex',
            partitionKey: { name: 'parent_email', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'transaction_date', type: dynamodb.AttributeType.STRING },
        });
        // Invoice log table
        const invoiceLogTable = new dynamodb.Table(this, 'InvoiceLogTable', {
            tableName: 'ehsshowchoir-invoice-log',
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            timeToLiveAttribute: 'ttl',
        });
        // Parent-student relationships table
        const parentStudentTable = new dynamodb.Table(this, 'ParentStudentTable', {
            tableName: 'ehsshowchoir-parent-student-relationships',
            partitionKey: { name: 'parent_email', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'student_id', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        // ==========================================
        // COGNITO AUTHENTICATION
        // ==========================================
        this.userPool = new cognito.UserPool(this, 'UserPool', {
            userPoolName: 'ehsshowchoir-users',
            selfSignUpEnabled: true,
            signInAliases: {
                email: true,
                username: false,
            },
            autoVerify: {
                email: true,
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            userInvitation: {
                emailSubject: 'Welcome to Edgewood Show Choir Payment Portal',
                emailBody: 'Hello {username}, your temporary password is {####}',
            },
            userVerification: {
                emailSubject: 'Verify your email for Edgewood Show Choir',
                emailBody: 'Your verification code is {####}',
            },
        });
        // Add custom domain for Cognito
        const userPoolDomain = this.userPool.addDomain('CognitoDomain', {
            cognitoDomain: {
                domainPrefix: 'ehsshowchoir-auth',
            },
        });
        const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
            userPool: this.userPool,
            generateSecret: false,
            authFlows: {
                adminUserPassword: true,
                userPassword: true,
                userSrp: true,
            },
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.PROFILE,
                ],
                callbackUrls: [
                    `https://${domainName}/auth/callback`,
                    `https://${domainName}/`,
                    'http://localhost:3000/auth/callback',
                    'http://localhost:3000/',
                ],
                logoutUrls: [
                    `https://${domainName}/auth/logout`,
                    `https://${domainName}/`,
                    'http://localhost:3000/auth/logout',
                    'http://localhost:3000/',
                ],
            },
            readAttributes: new cognito.ClientAttributes()
                .withStandardAttributes({
                email: true,
                emailVerified: true,
                givenName: true,
                familyName: true,
            }),
            writeAttributes: new cognito.ClientAttributes()
                .withStandardAttributes({
                email: true,
                givenName: true,
                familyName: true,
            }),
        });
        // ==========================================
        // IAM ROLES AND POLICIES
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
                                'dynamodb:BatchGetItem',
                                'dynamodb:BatchWriteItem',
                            ],
                            resources: [
                                studentsTable.tableArn,
                                paymentHistoryTable.tableArn,
                                invoiceLogTable.tableArn,
                                parentStudentTable.tableArn,
                                `${studentsTable.tableArn}/index/*`,
                                `${paymentHistoryTable.tableArn}/index/*`,
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
                                's3:GetSignedUrl',
                            ],
                            resources: [
                                `${invoicesBucket.bucketArn}/*`,
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
                                'ses:SendBulkTemplatedEmail',
                            ],
                            resources: ['*'],
                        }),
                    ],
                }),
                CognitoAccess: new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            effect: iam.Effect.ALLOW,
                            actions: [
                                'cognito-idp:AdminGetUser',
                                'cognito-idp:AdminListGroupsForUser',
                                'cognito-idp:AdminAddUserToGroup',
                                'cognito-idp:AdminRemoveUserFromGroup',
                            ],
                            resources: [this.userPool.userPoolArn],
                        }),
                    ],
                }),
            },
        });
        // ==========================================
        // LAMBDA FUNCTIONS
        // ==========================================
        // Main API Lambda
        const apiHandler = new lambda.Function(this, 'ApiHandler', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda'),
            role: lambdaRole,
            environment: {
                STUDENTS_TABLE: studentsTable.tableName,
                PAYMENT_HISTORY_TABLE: paymentHistoryTable.tableName,
                INVOICE_LOG_TABLE: invoiceLogTable.tableName,
                PARENT_STUDENT_TABLE: parentStudentTable.tableName,
                INVOICES_BUCKET: invoicesBucket.bucketName,
                USER_POOL_ID: this.userPool.userPoolId,
                FROM_EMAIL: `treasurer@${domainName}`,
                DOMAIN_NAME: domainName,
                AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
            },
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
            logRetention: logs.RetentionDays.ONE_MONTH,
            description: 'Main API handler for EHS Show Choir',
        });
        // Bulk Invoice Lambda
        const bulkInvoiceHandler = new lambda.Function(this, 'BulkInvoiceHandler', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'bulk-invoice-handler.bulkInvoiceHandler',
            code: lambda.Code.fromAsset('lambda'),
            role: lambdaRole,
            environment: {
                STUDENTS_TABLE: studentsTable.tableName,
                PAYMENT_HISTORY_TABLE: paymentHistoryTable.tableName,
                INVOICE_LOG_TABLE: invoiceLogTable.tableName,
                PARENT_STUDENT_TABLE: parentStudentTable.tableName,
                INVOICES_BUCKET: invoicesBucket.bucketName,
                FROM_EMAIL: `treasurer@${domainName}`,
                DOMAIN_NAME: domainName,
                AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
            },
            timeout: cdk.Duration.minutes(15),
            memorySize: 1024,
            logRetention: logs.RetentionDays.ONE_MONTH,
            description: 'Bulk invoice processing for EHS Show Choir',
        });
        // ==========================================
        // API GATEWAY
        // ==========================================
        this.api = new apigateway.RestApi(this, 'Api', {
            restApiName: 'ehsshowchoir-api',
            description: 'EHS Show Choir Payment System API',
            defaultCorsPreflightOptions: {
                allowOrigins: [
                    `https://${domainName}`,
                    `https://www.${domainName}`,
                    'http://localhost:3000',
                    'http://localhost:5173',
                ],
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: [
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                    'X-Amz-User-Agent',
                ],
                allowCredentials: true,
            },
            deployOptions: {
                stageName: 'prod',
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
            },
        });
        // API Gateway Authorizer
        const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
            cognitoUserPools: [this.userPool],
            identitySource: 'method.request.header.Authorization',
        });
        // API integrations
        const apiIntegration = new apigateway.LambdaIntegration(apiHandler, {
            requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
        });
        const bulkInvoiceIntegration = new apigateway.LambdaIntegration(bulkInvoiceHandler, {
            requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
        });
        // API Routes
        // Public routes
        const healthResource = this.api.root.addResource('health');
        healthResource.addMethod('GET', apiIntegration);
        // Protected routes
        const studentsResource = this.api.root.addResource('students');
        studentsResource.addMethod('GET', apiIntegration, { authorizer });
        studentsResource.addMethod('POST', apiIntegration, { authorizer });
        const studentResource = studentsResource.addResource('{studentId}');
        studentResource.addMethod('GET', apiIntegration, { authorizer });
        studentResource.addMethod('PUT', apiIntegration, { authorizer });
        studentResource.addMethod('DELETE', apiIntegration, { authorizer });
        const studentInvoiceDataResource = studentResource.addResource('invoice-data');
        studentInvoiceDataResource.addMethod('GET', apiIntegration, { authorizer });
        const studentPaymentHistoryResource = studentResource.addResource('payment-history');
        studentPaymentHistoryResource.addMethod('GET', apiIntegration, { authorizer });
        const invoicesResource = this.api.root.addResource('invoices');
        const bulkSendResource = invoicesResource.addResource('bulk-send');
        bulkSendResource.addMethod('POST', bulkInvoiceIntegration, { authorizer });
        const generateIndividualResource = invoicesResource.addResource('generate-individual');
        generateIndividualResource.addMethod('POST', apiIntegration, { authorizer });
        const paymentHistoryResource = this.api.root.addResource('payment-history');
        paymentHistoryResource.addMethod('GET', apiIntegration, { authorizer });
        paymentHistoryResource.addMethod('POST', apiIntegration, { authorizer });
        // ==========================================
        // SSL CERTIFICATE AND CLOUDFRONT
        // ==========================================
        let certificate;
        if (props.certificateArn) {
            certificate = certificatemanager.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn);
        }
        else {
            // Create certificate in us-east-1 for CloudFront
            certificate = new certificatemanager.Certificate(this, 'Certificate', {
                domainName,
                subjectAlternativeNames: [`www.${domainName}`],
                validation: certificatemanager.CertificateValidation.fromDns(),
            });
        }
        // CloudFront OAI
        const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
            comment: `OAI for ${domainName}`,
        });
        websiteBucket.grantRead(originAccessIdentity);
        // CloudFront Distribution
        this.distribution = new cloudfront.Distribution(this, 'Distribution', {
            domainNames: [domainName, `www.${domainName}`],
            certificate,
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
            defaultBehavior: {
                origin: new origins.S3Origin(websiteBucket, {
                    originAccessIdentity,
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                compress: true,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
            },
            additionalBehaviors: {
                '/api/*': {
                    origin: new origins.RestApiOrigin(this.api),
                    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                    originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
                },
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.minutes(5),
                },
                {
                    httpStatus: 403,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                    ttl: cdk.Duration.minutes(5),
                },
            ],
            comment: 'EHS Show Choir Payment System Distribution',
        });
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
        // Required outputs for frontend
        new aws_cdk_lib_1.CfnOutput(this, 'WebsiteBucketName', {
            value: this.websiteBucket ? this.websiteBucket.bucketName : 'ehsshowchoir-website-bucket',
            description: 'Website S3 Bucket Name'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'CloudFrontDistributionId', {
            value: this.distribution ? this.distribution.distributionId : 'MISSING_DISTRIBUTION',
            description: 'CloudFront Distribution ID'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'ApiUrl', {
            value: this.api ? this.api.url : 'MISSING_API',
            description: 'API Gateway URL'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'UserPoolId', {
            value: this.userPool ? this.userPool.userPoolId : 'MISSING_USER_POOL',
            description: 'Cognito User Pool ID'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'UserPoolClientId', {
            value: this.userPoolClient ? this.userPoolClient.userPoolClientId : 'MISSING_CLIENT',
            description: 'Cognito User Pool Client ID'
        });
        new aws_cdk_lib_1.CfnOutput(this, 'CognitoDomain', {
            value: this.userPoolDomain ? this.userPoolDomain.domainName : 'MISSING_DOMAIN',
            description: 'Cognito Domain'
        });
    }
}
exports.EhsShowchoirStack = EhsShowchoirStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWhzc2hvd2Nob2lyLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZWhzc2hvd2Nob2lyLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsNkNBQTJEO0FBQzNELGlEQUFtQztBQUNuQyx1REFBeUM7QUFDekMsdUVBQXlEO0FBQ3pELDRFQUE4RDtBQUM5RCx1RkFBeUU7QUFDekUsK0RBQWlEO0FBQ2pELHVFQUF5RDtBQUN6RCxpRUFBbUQ7QUFDbkQsbUVBQXFEO0FBQ3JELHlEQUEyQztBQUMzQyx5REFBMkM7QUFDM0MsMkRBQTZDO0FBUTdDLE1BQWEsaUJBQWtCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFLOUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxRQUFnQyxFQUFFO1FBQzFFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLElBQUksK0JBQStCLENBQUM7UUFFdkUsNkNBQTZDO1FBQzdDLGFBQWE7UUFDYiw2Q0FBNkM7UUFFN0MseUJBQXlCO1FBQ3pCLE1BQU0sYUFBYSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3pELFVBQVUsRUFBRSx3QkFBd0IsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ2pFLGdCQUFnQixFQUFFLEtBQUs7WUFDdkIsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN4QyxpQkFBaUIsRUFBRSxJQUFJO1lBQ3ZCLFNBQVMsRUFBRSxJQUFJO1lBQ2YsY0FBYyxFQUFFO2dCQUNkO29CQUNFLEVBQUUsRUFBRSxtQkFBbUI7b0JBQ3ZCLDJCQUEyQixFQUFFLEdBQUcsQ0FB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cm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGNlcnRpZmljYXRlbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2VydGlmaWNhdGVtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgc2VzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZXMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgeyBDZm5PdXRwdXQsIENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5pbnRlcmZhY2UgRWhzU2hvd2Nob2lyU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZG9tYWluTmFtZT86IHN0cmluZztcbiAgY2VydGlmaWNhdGVBcm4/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBFaHNTaG93Y2hvaXJTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XG4gIHB1YmxpYyByZWFkb25seSB1c2VyUG9vbDogY29nbml0by5Vc2VyUG9vbDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRWhzU2hvd2Nob2lyU3RhY2tQcm9wcyA9IHt9KSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCBkb21haW5OYW1lID0gcHJvcHMuZG9tYWluTmFtZSB8fCAnZWRnZXdvb2RzaG93Y2hvaXJwYXltZW50cy5vcmcnO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gUzMgQlVDS0VUU1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gV2Vic2l0ZSBob3N0aW5nIGJ1Y2tldFxuICAgIGNvbnN0IHdlYnNpdGVCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdXZWJzaXRlQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGVoc3Nob3djaG9pci13ZWJzaXRlLSR7dGhpcy5hY2NvdW50fS0ke3RoaXMucmVnaW9ufWAsXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiBmYWxzZSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgICB2ZXJzaW9uZWQ6IHRydWUsXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdEZWxldGVPbGRWZXJzaW9ucycsXG4gICAgICAgICAgbm9uY3VycmVudFZlcnNpb25FeHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygzMCksXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBJbnZvaWNlIHN0b3JhZ2UgYnVja2V0XG4gICAgY29uc3QgaW52b2ljZXNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdJbnZvaWNlc0J1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGBlaHNzaG93Y2hvaXItaW52b2ljZXMtJHt0aGlzLmFjY291bnR9LSR7dGhpcy5yZWdpb259YCxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0FyY2hpdmVPbGRJbnZvaWNlcycsXG4gICAgICAgICAgdHJhbnNpdGlvbnM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuSU5GUkVRVUVOVF9BQ0NFU1MsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoOTApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RvcmFnZUNsYXNzOiBzMy5TdG9yYWdlQ2xhc3MuR0xBQ0lFUixcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cygzNjUpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZVZlcnlPbGRJbnZvaWNlcycsXG4gICAgICAgICAgZXhwaXJhdGlvbjogY2RrLkR1cmF0aW9uLmRheXMoMjU1NSksIC8vIDcgeWVhcnMgZm9yIHRheCBjb21wbGlhbmNlXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBEWU5BTU9EQiBUQUJMRVNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIFN0dWRlbnRzIHRhYmxlXG4gICAgY29uc3Qgc3R1ZGVudHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnU3R1ZGVudHNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ2Voc3Nob3djaG9pci1zdHVkZW50cycsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgc3RyZWFtOiBkeW5hbW9kYi5TdHJlYW1WaWV3VHlwZS5ORVdfQU5EX09MRF9JTUFHRVMsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBwYXJlbnQgZW1haWwgbG9va3Vwc1xuICAgIHN0dWRlbnRzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnUGFyZW50RW1haWxJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3BhcmVudEVtYWlsJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHN0YXR1cyBmaWx0ZXJpbmdcbiAgICBzdHVkZW50c1RhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1N0YXR1c0luZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnc3RhdHVzJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2NyZWF0ZWRBdCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBQYXltZW50IGhpc3RvcnkgdGFibGVcbiAgICBjb25zdCBwYXltZW50SGlzdG9yeVRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdQYXltZW50SGlzdG9yeVRhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnZWhzc2hvd2Nob2lyLXBheW1lbnQtaGlzdG9yeScsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RyYW5zYWN0aW9uX2RhdGUnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IHRydWUsXG4gICAgICBzdHJlYW06IGR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLk5FV19BTkRfT0xEX0lNQUdFUyxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHN0dWRlbnQgbG9va3Vwc1xuICAgIHBheW1lbnRIaXN0b3J5VGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnU3R1ZGVudElkSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdzdHVkZW50X2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RyYW5zYWN0aW9uX2RhdGUnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3IgcGFyZW50IGVtYWlsIGxvb2t1cHNcbiAgICBwYXltZW50SGlzdG9yeVRhYmxlLmFkZEdsb2JhbFNlY29uZGFyeUluZGV4KHtcbiAgICAgIGluZGV4TmFtZTogJ1BhcmVudEVtYWlsSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdwYXJlbnRfZW1haWwnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAndHJhbnNhY3Rpb25fZGF0ZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBJbnZvaWNlIGxvZyB0YWJsZVxuICAgIGNvbnN0IGludm9pY2VMb2dUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnSW52b2ljZUxvZ1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnZWhzc2hvd2Nob2lyLWludm9pY2UtbG9nJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnY3JlYXRlZF9hdCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgdGltZVRvTGl2ZUF0dHJpYnV0ZTogJ3R0bCcsXG4gICAgfSk7XG5cbiAgICAvLyBQYXJlbnQtc3R1ZGVudCByZWxhdGlvbnNoaXBzIHRhYmxlXG4gICAgY29uc3QgcGFyZW50U3R1ZGVudFRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdQYXJlbnRTdHVkZW50VGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6ICdlaHNzaG93Y2hvaXItcGFyZW50LXN0dWRlbnQtcmVsYXRpb25zaGlwcycsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3BhcmVudF9lbWFpbCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdzdHVkZW50X2lkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDT0dOSVRPIEFVVEhFTlRJQ0FUSU9OXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICB0aGlzLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ1VzZXJQb29sJywge1xuICAgICAgdXNlclBvb2xOYW1lOiAnZWhzc2hvd2Nob2lyLXVzZXJzJyxcbiAgICAgIHNlbGZTaWduVXBFbmFibGVkOiB0cnVlLFxuICAgICAgc2lnbkluQWxpYXNlczoge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgdXNlcm5hbWU6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGF1dG9WZXJpZnk6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICB9LFxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcbiAgICAgICAgbWluTGVuZ3RoOiA4LFxuICAgICAgICByZXF1aXJlTG93ZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxuICAgICAgICByZXF1aXJlRGlnaXRzOiB0cnVlLFxuICAgICAgICByZXF1aXJlU3ltYm9sczogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICB1c2VySW52aXRhdGlvbjoge1xuICAgICAgICBlbWFpbFN1YmplY3Q6ICdXZWxjb21lIHRvIEVkZ2V3b29kIFNob3cgQ2hvaXIgUGF5bWVudCBQb3J0YWwnLFxuICAgICAgICBlbWFpbEJvZHk6ICdIZWxsbyB7dXNlcm5hbWV9LCB5b3VyIHRlbXBvcmFyeSBwYXNzd29yZCBpcyB7IyMjI30nLFxuICAgICAgfSxcbiAgICAgIHVzZXJWZXJpZmljYXRpb246IHtcbiAgICAgICAgZW1haWxTdWJqZWN0OiAnVmVyaWZ5IHlvdXIgZW1haWwgZm9yIEVkZ2V3b29kIFNob3cgQ2hvaXInLFxuICAgICAgICBlbWFpbEJvZHk6ICdZb3VyIHZlcmlmaWNhdGlvbiBjb2RlIGlzIHsjIyMjfScsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIGN1c3RvbSBkb21haW4gZm9yIENvZ25pdG9cbiAgICBjb25zdCB1c2VyUG9vbERvbWFpbiA9IHRoaXMudXNlclBvb2wuYWRkRG9tYWluKCdDb2duaXRvRG9tYWluJywge1xuICAgICAgY29nbml0b0RvbWFpbjoge1xuICAgICAgICBkb21haW5QcmVmaXg6ICdlaHNzaG93Y2hvaXItYXV0aCcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCAnVXNlclBvb2xDbGllbnQnLCB7XG4gICAgICB1c2VyUG9vbDogdGhpcy51c2VyUG9vbCxcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcbiAgICAgIGF1dGhGbG93czoge1xuICAgICAgICBhZG1pblVzZXJQYXNzd29yZDogdHJ1ZSxcbiAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIG9BdXRoOiB7XG4gICAgICAgIGZsb3dzOiB7XG4gICAgICAgICAgYXV0aG9yaXphdGlvbkNvZGVHcmFudDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgc2NvcGVzOiBbXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLkVNQUlMLFxuICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5PUEVOSUQsXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLlBST0ZJTEUsXG4gICAgICAgIF0sXG4gICAgICAgIGNhbGxiYWNrVXJsczogW1xuICAgICAgICAgIGBodHRwczovLyR7ZG9tYWluTmFtZX0vYXV0aC9jYWxsYmFja2AsXG4gICAgICAgICAgYGh0dHBzOi8vJHtkb21haW5OYW1lfS9gLFxuICAgICAgICAgICdodHRwOi8vbG9jYWxob3N0OjMwMDAvYXV0aC9jYWxsYmFjaycsXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC8nLFxuICAgICAgICBdLFxuICAgICAgICBsb2dvdXRVcmxzOiBbXG4gICAgICAgICAgYGh0dHBzOi8vJHtkb21haW5OYW1lfS9hdXRoL2xvZ291dGAsXG4gICAgICAgICAgYGh0dHBzOi8vJHtkb21haW5OYW1lfS9gLFxuICAgICAgICAgICdodHRwOi8vbG9jYWxob3N0OjMwMDAvYXV0aC9sb2dvdXQnLFxuICAgICAgICAgICdodHRwOi8vbG9jYWxob3N0OjMwMDAvJyxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICByZWFkQXR0cmlidXRlczogbmV3IGNvZ25pdG8uQ2xpZW50QXR0cmlidXRlcygpXG4gICAgICAgIC53aXRoU3RhbmRhcmRBdHRyaWJ1dGVzKHtcbiAgICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgICBlbWFpbFZlcmlmaWVkOiB0cnVlLFxuICAgICAgICAgIGdpdmVuTmFtZTogdHJ1ZSxcbiAgICAgICAgICBmYW1pbHlOYW1lOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgIHdyaXRlQXR0cmlidXRlczogbmV3IGNvZ25pdG8uQ2xpZW50QXR0cmlidXRlcygpXG4gICAgICAgIC53aXRoU3RhbmRhcmRBdHRyaWJ1dGVzKHtcbiAgICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgICAgICBnaXZlbk5hbWU6IHRydWUsXG4gICAgICAgICAgZmFtaWx5TmFtZTogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBJQU0gUk9MRVMgQU5EIFBPTElDSUVTXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBjb25zdCBsYW1iZGFSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdMYW1iZGFSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKCdzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlJyksXG4gICAgICBdLFxuICAgICAgaW5saW5lUG9saWNpZXM6IHtcbiAgICAgICAgRHluYW1vREJBY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkdldEl0ZW0nLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpQdXRJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6VXBkYXRlSXRlbScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkRlbGV0ZUl0ZW0nLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpRdWVyeScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlNjYW4nLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpCYXRjaEdldEl0ZW0nLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpCYXRjaFdyaXRlSXRlbScsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIHN0dWRlbnRzVGFibGUudGFibGVBcm4sXG4gICAgICAgICAgICAgICAgcGF5bWVudEhpc3RvcnlUYWJsZS50YWJsZUFybixcbiAgICAgICAgICAgICAgICBpbnZvaWNlTG9nVGFibGUudGFibGVBcm4sXG4gICAgICAgICAgICAgICAgcGFyZW50U3R1ZGVudFRhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgICAgICAgIGAke3N0dWRlbnRzVGFibGUudGFibGVBcm59L2luZGV4LypgLFxuICAgICAgICAgICAgICAgIGAke3BheW1lbnRIaXN0b3J5VGFibGUudGFibGVBcm59L2luZGV4LypgLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICAgIFMzQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdzMzpHZXRPYmplY3QnLFxuICAgICAgICAgICAgICAgICdzMzpQdXRPYmplY3QnLFxuICAgICAgICAgICAgICAgICdzMzpEZWxldGVPYmplY3QnLFxuICAgICAgICAgICAgICAgICdzMzpHZXRTaWduZWRVcmwnLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgJHtpbnZvaWNlc0J1Y2tldC5idWNrZXRBcm59LypgLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICAgIFNFU0FjY2VzczogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnc2VzOlNlbmRFbWFpbCcsXG4gICAgICAgICAgICAgICAgJ3NlczpTZW5kUmF3RW1haWwnLFxuICAgICAgICAgICAgICAgICdzZXM6U2VuZEJ1bGtUZW1wbGF0ZWRFbWFpbCcsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgICAgQ29nbml0b0FjY2VzczogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5HZXRVc2VyJyxcbiAgICAgICAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5MaXN0R3JvdXBzRm9yVXNlcicsXG4gICAgICAgICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluQWRkVXNlclRvR3JvdXAnLFxuICAgICAgICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pblJlbW92ZVVzZXJGcm9tR3JvdXAnLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFt0aGlzLnVzZXJQb29sLnVzZXJQb29sQXJuXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIExBTUJEQSBGVU5DVElPTlNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8vIE1haW4gQVBJIExhbWJkYVxuICAgIGNvbnN0IGFwaUhhbmRsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBcGlIYW5kbGVyJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFNUVURFTlRTX1RBQkxFOiBzdHVkZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgUEFZTUVOVF9ISVNUT1JZX1RBQkxFOiBwYXltZW50SGlzdG9yeVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgSU5WT0lDRV9MT0dfVEFCTEU6IGludm9pY2VMb2dUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFBBUkVOVF9TVFVERU5UX1RBQkxFOiBwYXJlbnRTdHVkZW50VGFibGUudGFibGVOYW1lLFxuICAgICAgICBJTlZPSUNFU19CVUNLRVQ6IGludm9pY2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFVTRVJfUE9PTF9JRDogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBGUk9NX0VNQUlMOiBgdHJlYXN1cmVyQCR7ZG9tYWluTmFtZX1gLFxuICAgICAgICBET01BSU5fTkFNRTogZG9tYWluTmFtZSxcbiAgICAgICAgQVdTX05PREVKU19DT05ORUNUSU9OX1JFVVNFX0VOQUJMRUQ6ICcxJyxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICBkZXNjcmlwdGlvbjogJ01haW4gQVBJIGhhbmRsZXIgZm9yIEVIUyBTaG93IENob2lyJyxcbiAgICB9KTtcblxuICAgIC8vIEJ1bGsgSW52b2ljZSBMYW1iZGFcbiAgICBjb25zdCBidWxrSW52b2ljZUhhbmRsZXIgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdCdWxrSW52b2ljZUhhbmRsZXInLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdidWxrLWludm9pY2UtaGFuZGxlci5idWxrSW52b2ljZUhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEnKSxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBTVFVERU5UU19UQUJMRTogc3R1ZGVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFBBWU1FTlRfSElTVE9SWV9UQUJMRTogcGF5bWVudEhpc3RvcnlUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIElOVk9JQ0VfTE9HX1RBQkxFOiBpbnZvaWNlTG9nVGFibGUudGFibGVOYW1lLFxuICAgICAgICBQQVJFTlRfU1RVREVOVF9UQUJMRTogcGFyZW50U3R1ZGVudFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgSU5WT0lDRVNfQlVDS0VUOiBpbnZvaWNlc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICBGUk9NX0VNQUlMOiBgdHJlYXN1cmVyQCR7ZG9tYWluTmFtZX1gLFxuICAgICAgICBET01BSU5fTkFNRTogZG9tYWluTmFtZSxcbiAgICAgICAgQVdTX05PREVKU19DT05ORUNUSU9OX1JFVVNFX0VOQUJMRUQ6ICcxJyxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgICBtZW1vcnlTaXplOiAxMDI0LFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgICAgZGVzY3JpcHRpb246ICdCdWxrIGludm9pY2UgcHJvY2Vzc2luZyBmb3IgRUhTIFNob3cgQ2hvaXInLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQVBJIEdBVEVXQVlcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHRoaXMuYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6ICdlaHNzaG93Y2hvaXItYXBpJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRUhTIFNob3cgQ2hvaXIgUGF5bWVudCBTeXN0ZW0gQVBJJyxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IFtcbiAgICAgICAgICBgaHR0cHM6Ly8ke2RvbWFpbk5hbWV9YCxcbiAgICAgICAgICBgaHR0cHM6Ly93d3cuJHtkb21haW5OYW1lfWAsXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6NTE3MycsXG4gICAgICAgIF0sXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJyxcbiAgICAgICAgICAnWC1BbXotRGF0ZScsXG4gICAgICAgICAgJ0F1dGhvcml6YXRpb24nLFxuICAgICAgICAgICdYLUFwaS1LZXknLFxuICAgICAgICAgICdYLUFtei1TZWN1cml0eS1Ub2tlbicsXG4gICAgICAgICAgJ1gtQW16LVVzZXItQWdlbnQnLFxuICAgICAgICBdLFxuICAgICAgICBhbGxvd0NyZWRlbnRpYWxzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgc3RhZ2VOYW1lOiAncHJvZCcsXG4gICAgICAgIGxvZ2dpbmdMZXZlbDogYXBpZ2F0ZXdheS5NZXRob2RMb2dnaW5nTGV2ZWwuSU5GTyxcbiAgICAgICAgZGF0YVRyYWNlRW5hYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSBBdXRob3JpemVyXG4gICAgY29uc3QgYXV0aG9yaXplciA9IG5ldyBhcGlnYXRld2F5LkNvZ25pdG9Vc2VyUG9vbHNBdXRob3JpemVyKHRoaXMsICdBdXRob3JpemVyJywge1xuICAgICAgY29nbml0b1VzZXJQb29sczogW3RoaXMudXNlclBvb2xdLFxuICAgICAgaWRlbnRpdHlTb3VyY2U6ICdtZXRob2QucmVxdWVzdC5oZWFkZXIuQXV0aG9yaXphdGlvbicsXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgaW50ZWdyYXRpb25zXG4gICAgY29uc3QgYXBpSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlIYW5kbGVyLCB7XG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7ICdhcHBsaWNhdGlvbi9qc29uJzogJ3sgXCJzdGF0dXNDb2RlXCI6IFwiMjAwXCIgfScgfSxcbiAgICB9KTtcbiAgICBcbiAgICBjb25zdCBidWxrSW52b2ljZUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYnVsa0ludm9pY2VIYW5kbGVyLCB7XG4gICAgICByZXF1ZXN0VGVtcGxhdGVzOiB7ICdhcHBsaWNhdGlvbi9qc29uJzogJ3sgXCJzdGF0dXNDb2RlXCI6IFwiMjAwXCIgfScgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBSb3V0ZXNcbiAgICAvLyBQdWJsaWMgcm91dGVzXG4gICAgY29uc3QgaGVhbHRoUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdoZWFsdGgnKTtcbiAgICBoZWFsdGhSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGFwaUludGVncmF0aW9uKTtcblxuICAgIC8vIFByb3RlY3RlZCByb3V0ZXNcbiAgICBjb25zdCBzdHVkZW50c1Jlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnc3R1ZGVudHMnKTtcbiAgICBzdHVkZW50c1Jlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgYXBpSW50ZWdyYXRpb24sIHsgYXV0aG9yaXplciB9KTtcbiAgICBzdHVkZW50c1Jlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIGFwaUludGVncmF0aW9uLCB7IGF1dGhvcml6ZXIgfSk7XG5cbiAgICBjb25zdCBzdHVkZW50UmVzb3VyY2UgPSBzdHVkZW50c1Jlc291cmNlLmFkZFJlc291cmNlKCd7c3R1ZGVudElkfScpO1xuICAgIHN0dWRlbnRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGFwaUludGVncmF0aW9uLCB7IGF1dGhvcml6ZXIgfSk7XG4gICAgc3R1ZGVudFJlc291cmNlLmFkZE1ldGhvZCgnUFVUJywgYXBpSW50ZWdyYXRpb24sIHsgYXV0aG9yaXplciB9KTtcbiAgICBzdHVkZW50UmVzb3VyY2UuYWRkTWV0aG9kKCdERUxFVEUnLCBhcGlJbnRlZ3JhdGlvbiwgeyBhdXRob3JpemVyIH0pO1xuXG4gICAgY29uc3Qgc3R1ZGVudEludm9pY2VEYXRhUmVzb3VyY2UgPSBzdHVkZW50UmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2ludm9pY2UtZGF0YScpO1xuICAgIHN0dWRlbnRJbnZvaWNlRGF0YVJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgYXBpSW50ZWdyYXRpb24sIHsgYXV0aG9yaXplciB9KTtcblxuICAgIGNvbnN0IHN0dWRlbnRQYXltZW50SGlzdG9yeVJlc291cmNlID0gc3R1ZGVudFJlc291cmNlLmFkZFJlc291cmNlKCdwYXltZW50LWhpc3RvcnknKTtcbiAgICBzdHVkZW50UGF5bWVudEhpc3RvcnlSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGFwaUludGVncmF0aW9uLCB7IGF1dGhvcml6ZXIgfSk7XG5cbiAgICBjb25zdCBpbnZvaWNlc1Jlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgnaW52b2ljZXMnKTtcbiAgICBjb25zdCBidWxrU2VuZFJlc291cmNlID0gaW52b2ljZXNSZXNvdXJjZS5hZGRSZXNvdXJjZSgnYnVsay1zZW5kJyk7XG4gICAgYnVsa1NlbmRSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBidWxrSW52b2ljZUludGVncmF0aW9uLCB7IGF1dGhvcml6ZXIgfSk7XG5cbiAgICBjb25zdCBnZW5lcmF0ZUluZGl2aWR1YWxSZXNvdXJjZSA9IGludm9pY2VzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ2dlbmVyYXRlLWluZGl2aWR1YWwnKTtcbiAgICBnZW5lcmF0ZUluZGl2aWR1YWxSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBhcGlJbnRlZ3JhdGlvbiwgeyBhdXRob3JpemVyIH0pO1xuXG4gICAgY29uc3QgcGF5bWVudEhpc3RvcnlSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3BheW1lbnQtaGlzdG9yeScpO1xuICAgIHBheW1lbnRIaXN0b3J5UmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBhcGlJbnRlZ3JhdGlvbiwgeyBhdXRob3JpemVyIH0pO1xuICAgIHBheW1lbnRIaXN0b3J5UmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgYXBpSW50ZWdyYXRpb24sIHsgYXV0aG9yaXplciB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFNTTCBDRVJUSUZJQ0FURSBBTkQgQ0xPVURGUk9OVFxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgbGV0IGNlcnRpZmljYXRlOiBjZXJ0aWZpY2F0ZW1hbmFnZXIuSUNlcnRpZmljYXRlO1xuICAgIFxuICAgIGlmIChwcm9wcy5jZXJ0aWZpY2F0ZUFybikge1xuICAgICAgY2VydGlmaWNhdGUgPSBjZXJ0aWZpY2F0ZW1hbmFnZXIuQ2VydGlmaWNhdGUuZnJvbUNlcnRpZmljYXRlQXJuKFxuICAgICAgICB0aGlzLCBcbiAgICAgICAgJ0NlcnRpZmljYXRlJywgXG4gICAgICAgIHByb3BzLmNlcnRpZmljYXRlQXJuXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBDcmVhdGUgY2VydGlmaWNhdGUgaW4gdXMtZWFzdC0xIGZvciBDbG91ZEZyb250XG4gICAgICBjZXJ0aWZpY2F0ZSA9IG5ldyBjZXJ0aWZpY2F0ZW1hbmFnZXIuQ2VydGlmaWNhdGUodGhpcywgJ0NlcnRpZmljYXRlJywge1xuICAgICAgICBkb21haW5OYW1lLFxuICAgICAgICBzdWJqZWN0QWx0ZXJuYXRpdmVOYW1lczogW2B3d3cuJHtkb21haW5OYW1lfWBdLFxuICAgICAgICB2YWxpZGF0aW9uOiBjZXJ0aWZpY2F0ZW1hbmFnZXIuQ2VydGlmaWNhdGVWYWxpZGF0aW9uLmZyb21EbnMoKSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIENsb3VkRnJvbnQgT0FJXG4gICAgY29uc3Qgb3JpZ2luQWNjZXNzSWRlbnRpdHkgPSBuZXcgY2xvdWRmcm9udC5PcmlnaW5BY2Nlc3NJZGVudGl0eSh0aGlzLCAnT0FJJywge1xuICAgICAgY29tbWVudDogYE9BSSBmb3IgJHtkb21haW5OYW1lfWAsXG4gICAgfSk7XG5cbiAgICB3ZWJzaXRlQnVja2V0LmdyYW50UmVhZChvcmlnaW5BY2Nlc3NJZGVudGl0eSk7XG5cbiAgICAvLyBDbG91ZEZyb250IERpc3RyaWJ1dGlvblxuICAgIHRoaXMuZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdEaXN0cmlidXRpb24nLCB7XG4gICAgICBkb21haW5OYW1lczogW2RvbWFpbk5hbWUsIGB3d3cuJHtkb21haW5OYW1lfWBdLFxuICAgICAgY2VydGlmaWNhdGUsXG4gICAgICBtaW5pbXVtUHJvdG9jb2xWZXJzaW9uOiBjbG91ZGZyb250LlNlY3VyaXR5UG9saWN5UHJvdG9jb2wuVExTX1YxXzJfMjAyMSxcbiAgICAgIHByaWNlQ2xhc3M6IGNsb3VkZnJvbnQuUHJpY2VDbGFzcy5QUklDRV9DTEFTU18xMDAsXG4gICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5TM09yaWdpbih3ZWJzaXRlQnVja2V0LCB7XG4gICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHksXG4gICAgICAgIH0pLFxuICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfR0VUX0hFQURfT1BUSU9OUyxcbiAgICAgICAgY29tcHJlc3M6IHRydWUsXG4gICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICByZXNwb25zZUhlYWRlcnNQb2xpY3k6IGNsb3VkZnJvbnQuUmVzcG9uc2VIZWFkZXJzUG9saWN5LlNFQ1VSSVRZX0hFQURFUlMsXG4gICAgICB9LFxuICAgICAgYWRkaXRpb25hbEJlaGF2aW9yczoge1xuICAgICAgICAnL2FwaS8qJzoge1xuICAgICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUmVzdEFwaU9yaWdpbih0aGlzLmFwaSksXG4gICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IGNsb3VkZnJvbnQuQWxsb3dlZE1ldGhvZHMuQUxMT1dfQUxMLFxuICAgICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfRElTQUJMRUQsXG4gICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTogY2xvdWRmcm9udC5PcmlnaW5SZXF1ZXN0UG9saWN5LkNPUlNfUzNfT1JJR0lOLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGRlZmF1bHRSb290T2JqZWN0OiAnaW5kZXguaHRtbCcsXG4gICAgICBlcnJvclJlc3BvbnNlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaHR0cFN0YXR1czogNDA0LFxuICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgICAgdHRsOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwMyxcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICAgIHR0bDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgY29tbWVudDogJ0VIUyBTaG93IENob2lyIFBheW1lbnQgU3lzdGVtIERpc3RyaWJ1dGlvbicsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBTRVMgRU1BSUwgQ09ORklHVVJBVElPTlxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgbmV3IHNlcy5FbWFpbElkZW50aXR5KHRoaXMsICdFbWFpbElkZW50aXR5Jywge1xuICAgICAgaWRlbnRpdHk6IHNlcy5JZGVudGl0eS5kb21haW4oZG9tYWluTmFtZSksXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgY29uZmlndXJhdGlvbiBzZXQgZm9yIHRyYWNraW5nXG4gICAgbmV3IHNlcy5Db25maWd1cmF0aW9uU2V0KHRoaXMsICdDb25maWd1cmF0aW9uU2V0Jywge1xuICAgICAgY29uZmlndXJhdGlvblNldE5hbWU6ICdlaHNzaG93Y2hvaXItZW1haWxzJyxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuLy8gUmVxdWlyZWQgb3V0cHV0cyBmb3IgZnJvbnRlbmRcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsICdXZWJzaXRlQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLndlYnNpdGVCdWNrZXQgPyB0aGlzLndlYnNpdGVCdWNrZXQuYnVja2V0TmFtZSA6ICdlaHNzaG93Y2hvaXItd2Vic2l0ZS1idWNrZXQnLFxuICAgICAgZGVzY3JpcHRpb246ICdXZWJzaXRlIFMzIEJ1Y2tldCBOYW1lJ1xuICAgIH0pO1xuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERpc3RyaWJ1dGlvbklkJywge1xuICAgICAgdmFsdWU6IHRoaXMuZGlzdHJpYnV0aW9uID8gdGhpcy5kaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQgOiAnTUlTU0lOR19ESVNUUklCVVRJT04nLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBJRCdcbiAgICB9KTtcblxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ0FwaVVybCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFwaSA/IHRoaXMuYXBpLnVybCA6ICdNSVNTSU5HX0FQSScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IFVSTCdcbiAgICB9KTtcblxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbCA/IHRoaXMudXNlclBvb2wudXNlclBvb2xJZCA6ICdNSVNTSU5HX1VTRVJfUE9PTCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJ1xuICAgIH0pO1xuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sQ2xpZW50ID8gdGhpcy51c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkIDogJ01JU1NJTkdfQ0xJRU5UJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50IElEJ1xuICAgIH0pO1xuXG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCAnQ29nbml0b0RvbWFpbicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnVzZXJQb29sRG9tYWluID8gdGhpcy51c2VyUG9vbERvbWFpbi5kb21haW5OYW1lIDogJ01JU1NJTkdfRE9NQUlOJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29nbml0byBEb21haW4nXG4gICAgfSk7XG59XG4iXX0=