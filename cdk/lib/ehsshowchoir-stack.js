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
    }
}
exports.EhsShowchoirStack = EhsShowchoirStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWhzc2hvd2Nob2lyLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZWhzc2hvd2Nob2lyLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsaURBQW1DO0FBQ25DLHVEQUF5QztBQUN6Qyx1RUFBeUQ7QUFDekQsNEVBQThEO0FBQzlELHVGQUF5RTtBQUN6RSwrREFBaUQ7QUFDakQsdUVBQXlEO0FBQ3pELGlFQUFtRDtBQUNuRCxtRUFBcUQ7QUFDckQseURBQTJDO0FBQzNDLHlEQUEyQztBQUMzQywyREFBNkM7QUFRN0MsTUFBYSxpQkFBa0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUs5QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLFFBQWdDLEVBQUU7UUFDMUUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLFVBQVUsSUFBSSwrQkFBK0IsQ0FBQztRQUV2RSw2Q0FBNkM7UUFDN0MsYUFBYTtRQUNiLDZDQUE2QztRQUU3Qyx5QkFBeUI7UUFDekIsTUFBTSxhQUFhLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDekQsVUFBVSxFQUFFLHdCQUF3QixJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDakUsZ0JBQWdCLEVBQUUsS0FBSztZQUN2QixpQkFBaUIsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztZQUNqRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3hDLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsU0FBUyxFQUFFLElBQUk7WUFDZixjQUFjLEVBQUU7Z0JBQ2Q7b0JBQ0UsRUFBRSxFQUFFLG1CQUFtQjtvQkFDdkIsMkJBQTJCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJ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WUFDRCxpQkFBaUIsRUFBRSxZQUFZO1lBQy9CLGNBQWMsRUFBRTtnQkFDZDtvQkFDRSxVQUFVLEVBQUUsR0FBRztvQkFDZixrQkFBa0IsRUFBRSxHQUFHO29CQUN2QixnQkFBZ0IsRUFBRSxhQUFhO29CQUMvQixHQUFHLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2lCQUM3QjtnQkFDRDtvQkFDRSxVQUFVLEVBQUUsR0FBRztvQkFDZixrQkFBa0IsRUFBRSxHQUFHO29CQUN2QixnQkFBZ0IsRUFBRSxhQUFhO29CQUMvQixHQUFHLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2lCQUM3QjthQUNGO1lBQ0QsT0FBTyxFQUFFLDRDQUE0QztTQUN0RCxDQUFDLENBQUM7UUFFSCw2Q0FBNkM7UUFDN0MsMEJBQTBCO1FBQzFCLDZDQUE2QztRQUU3QyxJQUFJLEdBQUcsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUMzQyxRQUFRLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO1NBQzFDLENBQUMsQ0FBQztRQUVILHdDQUF3QztRQUN4QyxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDakQsb0JBQW9CLEVBQUUscUJBQXFCO1NBQzVDLENBQUMsQ0FBQztRQUVILDZDQUE2QztRQUNqRCxnQ0FBZ0M7SUFDOUIsQ0FBQztDQUNGO0FBamdCRCw4Q0FpZ0JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU3RhY2ssIFN0YWNrUHJvcHMsIENmbk91dHB1dCB9IGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgY2VydGlmaWNhdGVtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jZXJ0aWZpY2F0ZW1hbmFnZXInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBjb2duaXRvIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2duaXRvJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzZXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlcyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCB7IENmbk91dHB1dCwgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmludGVyZmFjZSBFaHNTaG93Y2hvaXJTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBkb21haW5OYW1lPzogc3RyaW5nO1xuICBjZXJ0aWZpY2F0ZUFybj86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEVoc1Nob3djaG9pclN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGRpc3RyaWJ1dGlvbjogY2xvdWRmcm9udC5EaXN0cmlidXRpb247XG4gIHB1YmxpYyByZWFkb25seSBhcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBFaHNTaG93Y2hvaXJTdGFja1Byb3BzID0ge30pIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGRvbWFpbk5hbWUgPSBwcm9wcy5kb21haW5OYW1lIHx8ICdlZGdld29vZHNob3djaG9pcnBheW1lbnRzLm9yZyc7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBTMyBCVUNLRVRTXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBXZWJzaXRlIGhvc3RpbmcgYnVja2V0XG4gICAgY29uc3Qgd2Vic2l0ZUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1dlYnNpdGVCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgZWhzc2hvd2Nob2lyLXdlYnNpdGUtJHt0aGlzLmFjY291bnR9LSR7dGhpcy5yZWdpb259YCxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0RlbGV0ZU9sZFZlcnNpb25zJyxcbiAgICAgICAgICBub25jdXJyZW50VmVyc2lvbkV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEludm9pY2Ugc3RvcmFnZSBidWNrZXRcbiAgICBjb25zdCBpbnZvaWNlc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0ludm9pY2VzQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGVoc3Nob3djaG9pci1pbnZvaWNlcy0ke3RoaXMuYWNjb3VudH0tJHt0aGlzLnJlZ2lvbn1gLFxuICAgICAgcHVibGljUmVhZEFjY2VzczogZmFsc2UsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnQXJjaGl2ZU9sZEludm9pY2VzJyxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5HTEFDSUVSLFxuICAgICAgICAgICAgICB0cmFuc2l0aW9uQWZ0ZXI6IGNkay5EdXJhdGlvbi5kYXlzKDM2NSksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIGlkOiAnRGVsZXRlVmVyeU9sZEludm9pY2VzJyxcbiAgICAgICAgICBleHBpcmF0aW9uOiBjZGsuRHVyYXRpb24uZGF5cygyNTU1KSwgLy8gNyB5ZWFycyBmb3IgdGF4IGNvbXBsaWFuY2VcbiAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIERZTkFNT0RCIFRBQkxFU1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gU3R1ZGVudHMgdGFibGVcbiAgICBjb25zdCBzdHVkZW50c1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdTdHVkZW50c1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnZWhzc2hvd2Nob2lyLXN0dWRlbnRzJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIHBvaW50SW5UaW1lUmVjb3Zlcnk6IHRydWUsXG4gICAgICBzdHJlYW06IGR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLk5FV19BTkRfT0xEX0lNQUdFUyxcbiAgICB9KTtcblxuICAgIC8vIEFkZCBHU0kgZm9yIHBhcmVudCBlbWFpbCBsb29rdXBzXG4gICAgc3R1ZGVudHNUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdQYXJlbnRFbWFpbEluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncGFyZW50RW1haWwnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3Igc3RhdHVzIGZpbHRlcmluZ1xuICAgIHN0dWRlbnRzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnU3RhdHVzSW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdzdGF0dXMnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnY3JlYXRlZEF0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICB9KTtcblxuICAgIC8vIFBheW1lbnQgaGlzdG9yeSB0YWJsZVxuICAgIGNvbnN0IHBheW1lbnRIaXN0b3J5VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1BheW1lbnRIaXN0b3J5VGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6ICdlaHNzaG93Y2hvaXItcGF5bWVudC1oaXN0b3J5JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAndHJhbnNhY3Rpb25fZGF0ZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgIHN0cmVhbTogZHluYW1vZGIuU3RyZWFtVmlld1R5cGUuTkVXX0FORF9PTERfSU1BR0VTLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEdTSSBmb3Igc3R1ZGVudCBsb29rdXBzXG4gICAgcGF5bWVudEhpc3RvcnlUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdTdHVkZW50SWRJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3N0dWRlbnRfaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAndHJhbnNhY3Rpb25fZGF0ZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgR1NJIGZvciBwYXJlbnQgZW1haWwgbG9va3Vwc1xuICAgIHBheW1lbnRIaXN0b3J5VGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnUGFyZW50RW1haWxJbmRleCcsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3BhcmVudF9lbWFpbCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0cmFuc2FjdGlvbl9kYXRlJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICB9KTtcblxuICAgIC8vIEludm9pY2UgbG9nIHRhYmxlXG4gICAgY29uc3QgaW52b2ljZUxvZ1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdJbnZvaWNlTG9nVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6ICdlaHNzaG93Y2hvaXItaW52b2ljZS1sb2cnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBzb3J0S2V5OiB7IG5hbWU6ICdjcmVhdGVkX2F0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICB0aW1lVG9MaXZlQXR0cmlidXRlOiAndHRsJyxcbiAgICB9KTtcblxuICAgIC8vIFBhcmVudC1zdHVkZW50IHJlbGF0aW9uc2hpcHMgdGFibGVcbiAgICBjb25zdCBwYXJlbnRTdHVkZW50VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1BhcmVudFN0dWRlbnRUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ2Voc3Nob3djaG9pci1wYXJlbnQtc3R1ZGVudC1yZWxhdGlvbnNoaXBzJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncGFyZW50X2VtYWlsJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3N0dWRlbnRfaWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIENPR05JVE8gQVVUSEVOVElDQVRJT05cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHRoaXMudXNlclBvb2wgPSBuZXcgY29nbml0by5Vc2VyUG9vbCh0aGlzLCAnVXNlclBvb2wnLCB7XG4gICAgICB1c2VyUG9vbE5hbWU6ICdlaHNzaG93Y2hvaXItdXNlcnMnLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXG4gICAgICBzaWduSW5BbGlhc2VzOiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICB1c2VybmFtZTogZmFsc2UsXG4gICAgICB9LFxuICAgICAgYXV0b1ZlcmlmeToge1xuICAgICAgICBlbWFpbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGFjY291bnRSZWNvdmVyeTogY29nbml0by5BY2NvdW50UmVjb3ZlcnkuRU1BSUxfT05MWSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcbiAgICAgIHVzZXJJbnZpdGF0aW9uOiB7XG4gICAgICAgIGVtYWlsU3ViamVjdDogJ1dlbGNvbWUgdG8gRWRnZXdvb2QgU2hvdyBDaG9pciBQYXltZW50IFBvcnRhbCcsXG4gICAgICAgIGVtYWlsQm9keTogJ0hlbGxvIHt1c2VybmFtZX0sIHlvdXIgdGVtcG9yYXJ5IHBhc3N3b3JkIGlzIHsjIyMjfScsXG4gICAgICB9LFxuICAgICAgdXNlclZlcmlmaWNhdGlvbjoge1xuICAgICAgICBlbWFpbFN1YmplY3Q6ICdWZXJpZnkgeW91ciBlbWFpbCBmb3IgRWRnZXdvb2QgU2hvdyBDaG9pcicsXG4gICAgICAgIGVtYWlsQm9keTogJ1lvdXIgdmVyaWZpY2F0aW9uIGNvZGUgaXMgeyMjIyN9JyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgY3VzdG9tIGRvbWFpbiBmb3IgQ29nbml0b1xuICAgIGNvbnN0IHVzZXJQb29sRG9tYWluID0gdGhpcy51c2VyUG9vbC5hZGREb21haW4oJ0NvZ25pdG9Eb21haW4nLCB7XG4gICAgICBjb2duaXRvRG9tYWluOiB7XG4gICAgICAgIGRvbWFpblByZWZpeDogJ2Voc3Nob3djaG9pci1hdXRoJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCB1c2VyUG9vbENsaWVudCA9IG5ldyBjb2duaXRvLlVzZXJQb29sQ2xpZW50KHRoaXMsICdVc2VyUG9vbENsaWVudCcsIHtcbiAgICAgIHVzZXJQb29sOiB0aGlzLnVzZXJQb29sLFxuICAgICAgZ2VuZXJhdGVTZWNyZXQ6IGZhbHNlLFxuICAgICAgYXV0aEZsb3dzOiB7XG4gICAgICAgIGFkbWluVXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXG4gICAgICAgIHVzZXJTcnA6IHRydWUsXG4gICAgICB9LFxuICAgICAgb0F1dGg6IHtcbiAgICAgICAgZmxvd3M6IHtcbiAgICAgICAgICBhdXRob3JpemF0aW9uQ29kZUdyYW50OiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICBzY29wZXM6IFtcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuRU1BSUwsXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLk9QRU5JRCxcbiAgICAgICAgICBjb2duaXRvLk9BdXRoU2NvcGUuUFJPRklMRSxcbiAgICAgICAgXSxcbiAgICAgICAgY2FsbGJhY2tVcmxzOiBbXG4gICAgICAgICAgYGh0dHBzOi8vJHtkb21haW5OYW1lfS9hdXRoL2NhbGxiYWNrYCxcbiAgICAgICAgICBgaHR0cHM6Ly8ke2RvbWFpbk5hbWV9L2AsXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9hdXRoL2NhbGxiYWNrJyxcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDAwLycsXG4gICAgICAgIF0sXG4gICAgICAgIGxvZ291dFVybHM6IFtcbiAgICAgICAgICBgaHR0cHM6Ly8ke2RvbWFpbk5hbWV9L2F1dGgvbG9nb3V0YCxcbiAgICAgICAgICBgaHR0cHM6Ly8ke2RvbWFpbk5hbWV9L2AsXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9hdXRoL2xvZ291dCcsXG4gICAgICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMC8nLFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIHJlYWRBdHRyaWJ1dGVzOiBuZXcgY29nbml0by5DbGllbnRBdHRyaWJ1dGVzKClcbiAgICAgICAgLndpdGhTdGFuZGFyZEF0dHJpYnV0ZXMoe1xuICAgICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICAgIGVtYWlsVmVyaWZpZWQ6IHRydWUsXG4gICAgICAgICAgZ2l2ZW5OYW1lOiB0cnVlLFxuICAgICAgICAgIGZhbWlseU5hbWU6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgd3JpdGVBdHRyaWJ1dGVzOiBuZXcgY29nbml0by5DbGllbnRBdHRyaWJ1dGVzKClcbiAgICAgICAgLndpdGhTdGFuZGFyZEF0dHJpYnV0ZXMoe1xuICAgICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgICAgIGdpdmVuTmFtZTogdHJ1ZSxcbiAgICAgICAgICBmYW1pbHlOYW1lOiB0cnVlLFxuICAgICAgICB9KSxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIElBTSBST0xFUyBBTkQgUE9MSUNJRVNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IGxhbWJkYVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0xhbWJkYVJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoJ3NlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGUnKSxcbiAgICAgIF0sXG4gICAgICBpbmxpbmVQb2xpY2llczoge1xuICAgICAgICBEeW5hbW9EQkFjY2VzczogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgc3RhdGVtZW50czogW1xuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6R2V0SXRlbScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlB1dEl0ZW0nLFxuICAgICAgICAgICAgICAgICdkeW5hbW9kYjpVcGRhdGVJdGVtJyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6RGVsZXRlSXRlbScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOlF1ZXJ5JyxcbiAgICAgICAgICAgICAgICAnZHluYW1vZGI6U2NhbicsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkJhdGNoR2V0SXRlbScsXG4gICAgICAgICAgICAgICAgJ2R5bmFtb2RiOkJhdGNoV3JpdGVJdGVtJyxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgc3R1ZGVudHNUYWJsZS50YWJsZUFybixcbiAgICAgICAgICAgICAgICBwYXltZW50SGlzdG9yeVRhYmxlLnRhYmxlQXJuLFxuICAgICAgICAgICAgICAgIGludm9pY2VMb2dUYWJsZS50YWJsZUFybixcbiAgICAgICAgICAgICAgICBwYXJlbnRTdHVkZW50VGFibGUudGFibGVBcm4sXG4gICAgICAgICAgICAgICAgYCR7c3R1ZGVudHNUYWJsZS50YWJsZUFybn0vaW5kZXgvKmAsXG4gICAgICAgICAgICAgICAgYCR7cGF5bWVudEhpc3RvcnlUYWJsZS50YWJsZUFybn0vaW5kZXgvKmAsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgICAgUzNBY2Nlc3M6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgJ3MzOkdldE9iamVjdCcsXG4gICAgICAgICAgICAgICAgJ3MzOlB1dE9iamVjdCcsXG4gICAgICAgICAgICAgICAgJ3MzOkRlbGV0ZU9iamVjdCcsXG4gICAgICAgICAgICAgICAgJ3MzOkdldFNpZ25lZFVybCcsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1xuICAgICAgICAgICAgICAgIGAke2ludm9pY2VzQnVja2V0LmJ1Y2tldEFybn0vKmAsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgICAgU0VTQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdzZXM6U2VuZEVtYWlsJyxcbiAgICAgICAgICAgICAgICAnc2VzOlNlbmRSYXdFbWFpbCcsXG4gICAgICAgICAgICAgICAgJ3NlczpTZW5kQnVsa1RlbXBsYXRlZEVtYWlsJyxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgICBDb2duaXRvQWNjZXNzOiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkdldFVzZXInLFxuICAgICAgICAgICAgICAgICdjb2duaXRvLWlkcDpBZG1pbkxpc3RHcm91cHNGb3JVc2VyJyxcbiAgICAgICAgICAgICAgICAnY29nbml0by1pZHA6QWRtaW5BZGRVc2VyVG9Hcm91cCcsXG4gICAgICAgICAgICAgICAgJ2NvZ25pdG8taWRwOkFkbWluUmVtb3ZlVXNlckZyb21Hcm91cCcsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW3RoaXMudXNlclBvb2wudXNlclBvb2xBcm5dLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gTEFNQkRBIEZVTkNUSU9OU1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gTWFpbiBBUEkgTGFtYmRhXG4gICAgY29uc3QgYXBpSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FwaUhhbmRsZXInLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhJyksXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgU1RVREVOVFNfVEFCTEU6IHN0dWRlbnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBQQVlNRU5UX0hJU1RPUllfVEFCTEU6IHBheW1lbnRIaXN0b3J5VGFibGUudGFibGVOYW1lLFxuICAgICAgICBJTlZPSUNFX0xPR19UQUJMRTogaW52b2ljZUxvZ1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgUEFSRU5UX1NUVURFTlRfVEFCTEU6IHBhcmVudFN0dWRlbnRUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIElOVk9JQ0VTX0JVQ0tFVDogaW52b2ljZXNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgVVNFUl9QT09MX0lEOiB0aGlzLnVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgICAgIEZST01fRU1BSUw6IGB0cmVhc3VyZXJAJHtkb21haW5OYW1lfWAsXG4gICAgICAgIERPTUFJTl9OQU1FOiBkb21haW5OYW1lLFxuICAgICAgICBBV1NfTk9ERUpTX0NPTk5FQ1RJT05fUkVVU0VfRU5BQkxFRDogJzEnLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnTWFpbiBBUEkgaGFuZGxlciBmb3IgRUhTIFNob3cgQ2hvaXInLFxuICAgIH0pO1xuXG4gICAgLy8gQnVsayBJbnZvaWNlIExhbWJkYVxuICAgIGNvbnN0IGJ1bGtJbnZvaWNlSGFuZGxlciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0J1bGtJbnZvaWNlSGFuZGxlcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2J1bGstaW52b2ljZS1oYW5kbGVyLmJ1bGtJbnZvaWNlSGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFNUVURFTlRTX1RBQkxFOiBzdHVkZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgUEFZTUVOVF9ISVNUT1JZX1RBQkxFOiBwYXltZW50SGlzdG9yeVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgSU5WT0lDRV9MT0dfVEFCTEU6IGludm9pY2VMb2dUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFBBUkVOVF9TVFVERU5UX1RBQkxFOiBwYXJlbnRTdHVkZW50VGFibGUudGFibGVOYW1lLFxuICAgICAgICBJTlZPSUNFU19CVUNLRVQ6IGludm9pY2VzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIEZST01fRU1BSUw6IGB0cmVhc3VyZXJAJHtkb21haW5OYW1lfWAsXG4gICAgICAgIERPTUFJTl9OQU1FOiBkb21haW5OYW1lLFxuICAgICAgICBBV1NfTk9ERUpTX0NPTk5FQ1RJT05fUkVVU0VfRU5BQkxFRDogJzEnLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICBkZXNjcmlwdGlvbjogJ0J1bGsgaW52b2ljZSBwcm9jZXNzaW5nIGZvciBFSFMgU2hvdyBDaG9pcicsXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBBUEkgR0FURVdBWVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgdGhpcy5hcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdBcGknLCB7XG4gICAgICByZXN0QXBpTmFtZTogJ2Voc3Nob3djaG9pci1hcGknLFxuICAgICAgZGVzY3JpcHRpb246ICdFSFMgU2hvdyBDaG9pciBQYXltZW50IFN5c3RlbSBBUEknLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogW1xuICAgICAgICAgIGBodHRwczovLyR7ZG9tYWluTmFtZX1gLFxuICAgICAgICAgIGBodHRwczovL3d3dy4ke2RvbWFpbk5hbWV9YCxcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDAwJyxcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDo1MTczJyxcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogW1xuICAgICAgICAgICdDb250ZW50LVR5cGUnLFxuICAgICAgICAgICdYLUFtei1EYXRlJyxcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbicsXG4gICAgICAgICAgJ1gtQXBpLUtleScsXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcbiAgICAgICAgICAnWC1BbXotVXNlci1BZ2VudCcsXG4gICAgICAgIF0sXG4gICAgICAgIGFsbG93Q3JlZGVudGlhbHM6IHRydWUsXG4gICAgICB9LFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBzdGFnZU5hbWU6ICdwcm9kJyxcbiAgICAgICAgbG9nZ2luZ0xldmVsOiBhcGlnYXRld2F5Lk1ldGhvZExvZ2dpbmdMZXZlbC5JTkZPLFxuICAgICAgICBkYXRhVHJhY2VFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBHYXRld2F5IEF1dGhvcml6ZXJcbiAgICBjb25zdCBhdXRob3JpemVyID0gbmV3IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXIodGhpcywgJ0F1dGhvcml6ZXInLCB7XG4gICAgICBjb2duaXRvVXNlclBvb2xzOiBbdGhpcy51c2VyUG9vbF0sXG4gICAgICBpZGVudGl0eVNvdXJjZTogJ21ldGhvZC5yZXF1ZXN0LmhlYWRlci5BdXRob3JpemF0aW9uJyxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBpbnRlZ3JhdGlvbnNcbiAgICBjb25zdCBhcGlJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUhhbmRsZXIsIHtcbiAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHsgJ2FwcGxpY2F0aW9uL2pzb24nOiAneyBcInN0YXR1c0NvZGVcIjogXCIyMDBcIiB9JyB9LFxuICAgIH0pO1xuICAgIFxuICAgIGNvbnN0IGJ1bGtJbnZvaWNlSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihidWxrSW52b2ljZUhhbmRsZXIsIHtcbiAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHsgJ2FwcGxpY2F0aW9uL2pzb24nOiAneyBcInN0YXR1c0NvZGVcIjogXCIyMDBcIiB9JyB9LFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIFJvdXRlc1xuICAgIC8vIFB1YmxpYyByb3V0ZXNcbiAgICBjb25zdCBoZWFsdGhSZXNvdXJjZSA9IHRoaXMuYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2hlYWx0aCcpO1xuICAgIGhlYWx0aFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgYXBpSW50ZWdyYXRpb24pO1xuXG4gICAgLy8gUHJvdGVjdGVkIHJvdXRlc1xuICAgIGNvbnN0IHN0dWRlbnRzUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdzdHVkZW50cycpO1xuICAgIHN0dWRlbnRzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBhcGlJbnRlZ3JhdGlvbiwgeyBhdXRob3JpemVyIH0pO1xuICAgIHN0dWRlbnRzUmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgYXBpSW50ZWdyYXRpb24sIHsgYXV0aG9yaXplciB9KTtcblxuICAgIGNvbnN0IHN0dWRlbnRSZXNvdXJjZSA9IHN0dWRlbnRzUmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3tzdHVkZW50SWR9Jyk7XG4gICAgc3R1ZGVudFJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgYXBpSW50ZWdyYXRpb24sIHsgYXV0aG9yaXplciB9KTtcbiAgICBzdHVkZW50UmVzb3VyY2UuYWRkTWV0aG9kKCdQVVQnLCBhcGlJbnRlZ3JhdGlvbiwgeyBhdXRob3JpemVyIH0pO1xuICAgIHN0dWRlbnRSZXNvdXJjZS5hZGRNZXRob2QoJ0RFTEVURScsIGFwaUludGVncmF0aW9uLCB7IGF1dGhvcml6ZXIgfSk7XG5cbiAgICBjb25zdCBzdHVkZW50SW52b2ljZURhdGFSZXNvdXJjZSA9IHN0dWRlbnRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnaW52b2ljZS1kYXRhJyk7XG4gICAgc3R1ZGVudEludm9pY2VEYXRhUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBhcGlJbnRlZ3JhdGlvbiwgeyBhdXRob3JpemVyIH0pO1xuXG4gICAgY29uc3Qgc3R1ZGVudFBheW1lbnRIaXN0b3J5UmVzb3VyY2UgPSBzdHVkZW50UmVzb3VyY2UuYWRkUmVzb3VyY2UoJ3BheW1lbnQtaGlzdG9yeScpO1xuICAgIHN0dWRlbnRQYXltZW50SGlzdG9yeVJlc291cmNlLmFkZE1ldGhvZCgnR0VUJywgYXBpSW50ZWdyYXRpb24sIHsgYXV0aG9yaXplciB9KTtcblxuICAgIGNvbnN0IGludm9pY2VzUmVzb3VyY2UgPSB0aGlzLmFwaS5yb290LmFkZFJlc291cmNlKCdpbnZvaWNlcycpO1xuICAgIGNvbnN0IGJ1bGtTZW5kUmVzb3VyY2UgPSBpbnZvaWNlc1Jlc291cmNlLmFkZFJlc291cmNlKCdidWxrLXNlbmQnKTtcbiAgICBidWxrU2VuZFJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIGJ1bGtJbnZvaWNlSW50ZWdyYXRpb24sIHsgYXV0aG9yaXplciB9KTtcblxuICAgIGNvbnN0IGdlbmVyYXRlSW5kaXZpZHVhbFJlc291cmNlID0gaW52b2ljZXNSZXNvdXJjZS5hZGRSZXNvdXJjZSgnZ2VuZXJhdGUtaW5kaXZpZHVhbCcpO1xuICAgIGdlbmVyYXRlSW5kaXZpZHVhbFJlc291cmNlLmFkZE1ldGhvZCgnUE9TVCcsIGFwaUludGVncmF0aW9uLCB7IGF1dGhvcml6ZXIgfSk7XG5cbiAgICBjb25zdCBwYXltZW50SGlzdG9yeVJlc291cmNlID0gdGhpcy5hcGkucm9vdC5hZGRSZXNvdXJjZSgncGF5bWVudC1oaXN0b3J5Jyk7XG4gICAgcGF5bWVudEhpc3RvcnlSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGFwaUludGVncmF0aW9uLCB7IGF1dGhvcml6ZXIgfSk7XG4gICAgcGF5bWVudEhpc3RvcnlSZXNvdXJjZS5hZGRNZXRob2QoJ1BPU1QnLCBhcGlJbnRlZ3JhdGlvbiwgeyBhdXRob3JpemVyIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gU1NMIENFUlRJRklDQVRFIEFORCBDTE9VREZST05UXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBsZXQgY2VydGlmaWNhdGU6IGNlcnRpZmljYXRlbWFuYWdlci5JQ2VydGlmaWNhdGU7XG4gICAgXG4gICAgaWYgKHByb3BzLmNlcnRpZmljYXRlQXJuKSB7XG4gICAgICBjZXJ0aWZpY2F0ZSA9IGNlcnRpZmljYXRlbWFuYWdlci5DZXJ0aWZpY2F0ZS5mcm9tQ2VydGlmaWNhdGVBcm4oXG4gICAgICAgIHRoaXMsIFxuICAgICAgICAnQ2VydGlmaWNhdGUnLCBcbiAgICAgICAgcHJvcHMuY2VydGlmaWNhdGVBcm5cbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIENyZWF0ZSBjZXJ0aWZpY2F0ZSBpbiB1cy1lYXN0LTEgZm9yIENsb3VkRnJvbnRcbiAgICAgIGNlcnRpZmljYXRlID0gbmV3IGNlcnRpZmljYXRlbWFuYWdlci5DZXJ0aWZpY2F0ZSh0aGlzLCAnQ2VydGlmaWNhdGUnLCB7XG4gICAgICAgIGRvbWFpbk5hbWUsXG4gICAgICAgIHN1YmplY3RBbHRlcm5hdGl2ZU5hbWVzOiBbYHd3dy4ke2RvbWFpbk5hbWV9YF0sXG4gICAgICAgIHZhbGlkYXRpb246IGNlcnRpZmljYXRlbWFuYWdlci5DZXJ0aWZpY2F0ZVZhbGlkYXRpb24uZnJvbURucygpLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRGcm9udCBPQUlcbiAgICBjb25zdCBvcmlnaW5BY2Nlc3NJZGVudGl0eSA9IG5ldyBjbG91ZGZyb250Lk9yaWdpbkFjY2Vzc0lkZW50aXR5KHRoaXMsICdPQUknLCB7XG4gICAgICBjb21tZW50OiBgT0FJIGZvciAke2RvbWFpbk5hbWV9YCxcbiAgICB9KTtcblxuICAgIHdlYnNpdGVCdWNrZXQuZ3JhbnRSZWFkKG9yaWdpbkFjY2Vzc0lkZW50aXR5KTtcblxuICAgIC8vIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uXG4gICAgdGhpcy5kaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ0Rpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGRvbWFpbk5hbWVzOiBbZG9tYWluTmFtZSwgYHd3dy4ke2RvbWFpbk5hbWV9YF0sXG4gICAgICBjZXJ0aWZpY2F0ZSxcbiAgICAgIG1pbmltdW1Qcm90b2NvbFZlcnNpb246IGNsb3VkZnJvbnQuU2VjdXJpdHlQb2xpY3lQcm90b2NvbC5UTFNfVjFfMl8yMDIxLFxuICAgICAgcHJpY2VDbGFzczogY2xvdWRmcm9udC5QcmljZUNsYXNzLlBSSUNFX0NMQVNTXzEwMCxcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHdlYnNpdGVCdWNrZXQsIHtcbiAgICAgICAgICBvcmlnaW5BY2Nlc3NJZGVudGl0eSxcbiAgICAgICAgfSksXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19HRVRfSEVBRF9PUFRJT05TLFxuICAgICAgICBjb21wcmVzczogdHJ1ZSxcbiAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19PUFRJTUlaRUQsXG4gICAgICAgIHJlc3BvbnNlSGVhZGVyc1BvbGljeTogY2xvdWRmcm9udC5SZXNwb25zZUhlYWRlcnNQb2xpY3kuU0VDVVJJVFlfSEVBREVSUyxcbiAgICAgIH0sXG4gICAgICBhZGRpdGlvbmFsQmVoYXZpb3JzOiB7XG4gICAgICAgICcvYXBpLyonOiB7XG4gICAgICAgICAgb3JpZ2luOiBuZXcgb3JpZ2lucy5SZXN0QXBpT3JpZ2luKHRoaXMuYXBpKSxcbiAgICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgICBhbGxvd2VkTWV0aG9kczogY2xvdWRmcm9udC5BbGxvd2VkTWV0aG9kcy5BTExPV19BTEwsXG4gICAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19ESVNBQkxFRCxcbiAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQ09SU19TM19PUklHSU4sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaHR0cFN0YXR1czogNDAzLFxuICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgICAgdHRsOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBjb21tZW50OiAnRUhTIFNob3cgQ2hvaXIgUGF5bWVudCBTeXN0ZW0gRGlzdHJpYnV0aW9uJyxcbiAgICB9KTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFNFUyBFTUFJTCBDT05GSUdVUkFUSU9OXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBuZXcgc2VzLkVtYWlsSWRlbnRpdHkodGhpcywgJ0VtYWlsSWRlbnRpdHknLCB7XG4gICAgICBpZGVudGl0eTogc2VzLklkZW50aXR5LmRvbWFpbihkb21haW5OYW1lKSxcbiAgICB9KTtcblxuICAgIC8vIENyZWF0ZSBjb25maWd1cmF0aW9uIHNldCBmb3IgdHJhY2tpbmdcbiAgICBuZXcgc2VzLkNvbmZpZ3VyYXRpb25TZXQodGhpcywgJ0NvbmZpZ3VyYXRpb25TZXQnLCB7XG4gICAgICBjb25maWd1cmF0aW9uU2V0TmFtZTogJ2Voc3Nob3djaG9pci1lbWFpbHMnLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBSZXF1aXJlZCBvdXRwdXRzIGZvciBmcm9udGVuZFxuICB9XG59XG4gIH1cbn0iXX0=