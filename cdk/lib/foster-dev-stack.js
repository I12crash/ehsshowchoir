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
exports.FosterDevStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const apigatewayIntegrations = __importStar(require("aws-cdk-lib/aws-apigatewayv2-integrations"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const nodejs = __importStar(require("aws-cdk-lib/aws-lambda-nodejs"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const path = __importStar(require("path"));
class FosterDevStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        const lambdaIntegration = new apigatewayIntegrations.HttpLambdaIntegration('LambdaIntegration', apiHandler);
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
            value: httpApi.url,
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
exports.FosterDevStack = FosterDevStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9zdGVyLWRldi1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImZvc3Rlci1kZXYtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsdURBQXlDO0FBQ3pDLHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFDOUQseUVBQTJEO0FBQzNELGtHQUFvRjtBQUNwRiwrREFBaUQ7QUFDakQsc0VBQXdEO0FBQ3hELGlFQUFtRDtBQUNuRCxtRUFBcUQ7QUFHckQsMkNBQTZCO0FBTTdCLE1BQWEsY0FBZSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzNDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMEI7UUFDbEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsa0JBQWtCO1FBQ2xCLE1BQU0sYUFBYSxHQUFHLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQzlELFNBQVMsRUFBRSxnQkFBZ0I7WUFDM0IsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUU7WUFDeEUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLENBQUMsZUFBZTtZQUNqRCxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1NBQ3pDLENBQUMsQ0FBQztRQUVILE1BQU0saUJBQWlCLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBRTtZQUN0RSxTQUFTLEVBQUUsb0JBQW9CO1lBQy9CLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFO1lBQzVFLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxDQUFDLGVB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b20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djInO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheUludGVncmF0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyLWludGVncmF0aW9ucyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBub2RlanMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYS1ub2RlanMnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEZvc3RlckRldlN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGhvc3RlZFVpUHJlZml4OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBGb3N0ZXJEZXZTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBGb3N0ZXJEZXZTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICAvLyBEeW5hbW9EQiBUYWJsZXNcbiAgICBjb25zdCBzdHVkZW50c1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdTdHVkZW50c1RhYmxlJywge1xuICAgICAgdGFibGVOYW1lOiAnY2hvaXItc3R1ZGVudHMnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdzdHVkZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICBjb25zdCB0cmFuc2FjdGlvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnVHJhbnNhY3Rpb25zVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6ICdjaG9pci10cmFuc2FjdGlvbnMnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICd0cmFuc2FjdGlvbklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcGFyZW50c1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdQYXJlbnRzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6ICdjaG9pci1wYXJlbnRzJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncGFyZW50SWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyBTMyBCdWNrZXRzXG4gICAgY29uc3Qgc2l0ZUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1NpdGVCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgZm9zdGVyLWRldi1zaXRlLSR7dGhpcy5hY2NvdW50fS0ke3RoaXMucmVnaW9ufWAsXG4gICAgICB3ZWJzaXRlSW5kZXhEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxuICAgICAgd2Vic2l0ZUVycm9yRG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICAgIGNvcnM6IFt7XG4gICAgICAgIGFsbG93ZWRIZWFkZXJzOiBbJyonXSxcbiAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtzMy5IdHRwTWV0aG9kcy5HRVQsIHMzLkh0dHBNZXRob2RzLkhFQURdLFxuICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICAgIG1heEFnZTogMzAwMCxcbiAgICAgIH1dLFxuICAgIH0pO1xuXG4gICAgY29uc3QgdXBsb2Fkc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1VwbG9hZHNCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgZm9zdGVyLWRldi11cGxvYWRzLSR7dGhpcy5hY2NvdW50fS0ke3RoaXMucmVnaW9ufWAsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgICBjb3JzOiBbe1xuICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VULCBzMy5IdHRwTWV0aG9kcy5QVVQsIHMzLkh0dHBNZXRob2RzLlBPU1QsIHMzLkh0dHBNZXRob2RzLkRFTEVURV0sXG4gICAgICAgIGFsbG93ZWRPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgbWF4QWdlOiAzMDAwLFxuICAgICAgfV0sXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZyb250IE9yaWdpbiBBY2Nlc3MgSWRlbnRpdHlcbiAgICBjb25zdCBvYWkgPSBuZXcgY2xvdWRmcm9udC5PcmlnaW5BY2Nlc3NJZGVudGl0eSh0aGlzLCAnT0FJJyk7XG4gICAgc2l0ZUJ1Y2tldC5ncmFudFJlYWQob2FpKTtcblxuICAgIC8vIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uIC0gVXNpbmcgUzNPcmlnaW4gKGRlcHJlY2F0ZWQgYnV0IHdvcmtzKVxuICAgIGNvbnN0IGRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnRGlzdHJpYnV0aW9uJywge1xuICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgIG9yaWdpbjogbmV3IG9yaWdpbnMuUzNPcmlnaW4oc2l0ZUJ1Y2tldCwge1xuICAgICAgICAgIG9yaWdpbkFjY2Vzc0lkZW50aXR5OiBvYWksXG4gICAgICAgIH0pLFxuICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19PUFRJTUlaRUQsXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFEX09QVElPTlMsXG4gICAgICB9LFxuICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDMsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgICB0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgaHR0cFN0YXR1czogNDA0LFxuICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgICAgdHRsOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgRnVuY3Rpb24gd2l0aCBEeW5hbW9EQiBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IGFwaUhhbmRsZXIgPSBuZXcgbm9kZWpzLk5vZGVqc0Z1bmN0aW9uKHRoaXMsICdBcGlIYW5kbGVyJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlcicsXG4gICAgICBlbnRyeTogcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL2xhbWJkYS9hcGkudHMnKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFVQTE9BRFNfQlVDS0VUOiB1cGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFNUVURFTlRTX1RBQkxFOiBzdHVkZW50c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgVFJBTlNBQ1RJT05TX1RBQkxFOiB0cmFuc2FjdGlvbnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFBBUkVOVFNfVEFCTEU6IHBhcmVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFJFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICAgIEFETUlOX0VNQUlMOiAnc2hvd2Nob2lydHJlYXN1cmVyQGdtYWlsLmNvbScsXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgYnVuZGxpbmc6IHtcbiAgICAgICAgZXh0ZXJuYWxNb2R1bGVzOiBbJ2F3cy1zZGsnXSxcbiAgICAgICAgbm9kZU1vZHVsZXM6IFtcbiAgICAgICAgICAnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJyxcbiAgICAgICAgICAnQGF3cy1zZGsvbGliLWR5bmFtb2RiJyxcbiAgICAgICAgICAnQGF3cy1zZGsvY2xpZW50LXNlcycsXG4gICAgICAgICAgJ0Bhd3Mtc2RrL2NsaWVudC1zMycsXG4gICAgICAgICAgJ3V1aWQnLFxuICAgICAgICBdLFxuICAgICAgICBtaW5pZnk6IGZhbHNlLFxuICAgICAgICBzb3VyY2VNYXA6IHRydWUsXG4gICAgICAgIHRhcmdldDogJ25vZGUxOCcsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gTGFtYmRhXG4gICAgdXBsb2Fkc0J1Y2tldC5ncmFudFJlYWRXcml0ZShhcGlIYW5kbGVyKTtcbiAgICBzdHVkZW50c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcGlIYW5kbGVyKTtcbiAgICB0cmFuc2FjdGlvbnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXBpSGFuZGxlcik7XG4gICAgcGFyZW50c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcGlIYW5kbGVyKTtcblxuICAgIC8vIEFQSSBHYXRld2F5IEhUVFAgQVBJXG4gICAgY29uc3QgaHR0cEFwaSA9IG5ldyBhcGlnYXRld2F5Lkh0dHBBcGkodGhpcywgJ0h0dHBBcGknLCB7XG4gICAgICBhcGlOYW1lOiAnZm9zdGVyLWRldi1hcGknLFxuICAgICAgY29yc1ByZWZsaWdodDoge1xuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nXSxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbXG4gICAgICAgICAgYXBpZ2F0ZXdheS5Db3JzSHR0cE1ldGhvZC5HRVQsXG4gICAgICAgICAgYXBpZ2F0ZXdheS5Db3JzSHR0cE1ldGhvZC5QT1NULFxuICAgICAgICAgIGFwaWdhdGV3YXkuQ29yc0h0dHBNZXRob2QuUFVULFxuICAgICAgICAgIGFwaWdhdGV3YXkuQ29yc0h0dHBNZXRob2QuREVMRVRFLFxuICAgICAgICAgIGFwaWdhdGV3YXkuQ29yc0h0dHBNZXRob2QuT1BUSU9OUyxcbiAgICAgICAgXSxcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBbJyonXSxcbiAgICAgICAgbWF4QWdlOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgSW50ZWdyYXRpb25cbiAgICBjb25zdCBsYW1iZGFJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5SW50ZWdyYXRpb25zLkh0dHBMYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgICdMYW1iZGFJbnRlZ3JhdGlvbicsXG4gICAgICBhcGlIYW5kbGVyXG4gICAgKTtcblxuICAgIC8vIEFQSSBSb3V0ZXMgLSBzaW1wbGlmaWVkIHRvIGNhdGNoIGFsbFxuICAgIGh0dHBBcGkuYWRkUm91dGVzKHtcbiAgICAgIHBhdGg6ICcve3Byb3h5K30nLFxuICAgICAgbWV0aG9kczogW2FwaWdhdGV3YXkuSHR0cE1ldGhvZC5BTlldLFxuICAgICAgaW50ZWdyYXRpb246IGxhbWJkYUludGVncmF0aW9uLFxuICAgIH0pO1xuXG4gICAgLy8gQWxzbyBhZGQgcm9vdCBwYXRoXG4gICAgaHR0cEFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy8nLFxuICAgICAgbWV0aG9kczogW2FwaWdhdGV3YXkuSHR0cE1ldGhvZC5BTlldLFxuICAgICAgaW50ZWdyYXRpb246IGxhbWJkYUludGVncmF0aW9uLFxuICAgIH0pO1xuXG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2xcbiAgICBjb25zdCB1c2VyUG9vbCA9IG5ldyBjb2duaXRvLlVzZXJQb29sKHRoaXMsICdVc2VyUG9vbCcsIHtcbiAgICAgIHVzZXJQb29sTmFtZTogJ2Zvc3Rlci1kZXYtdXNlcnMnLFxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXG4gICAgICBzaWduSW5BbGlhc2VzOiB7XG4gICAgICAgIGVtYWlsOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGF1dG9WZXJpZnk6IHtcbiAgICAgICAgZW1haWw6IHRydWUsXG4gICAgICB9LFxuICAgICAgc3RhbmRhcmRBdHRyaWJ1dGVzOiB7XG4gICAgICAgIGVtYWlsOiB7XG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBwYXNzd29yZFBvbGljeToge1xuICAgICAgICBtaW5MZW5ndGg6IDgsXG4gICAgICAgIHJlcXVpcmVMb3dlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVVcHBlcmNhc2U6IHRydWUsXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXG4gICAgICAgIHJlcXVpcmVTeW1ib2xzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gQ29nbml0byBVc2VyIFBvb2wgQ2xpZW50XG4gICAgY29uc3QgdXNlclBvb2xDbGllbnQgPSBuZXcgY29nbml0by5Vc2VyUG9vbENsaWVudCh0aGlzLCAnVXNlclBvb2xDbGllbnQnLCB7XG4gICAgICB1c2VyUG9vbCxcbiAgICAgIHVzZXJQb29sQ2xpZW50TmFtZTogJ2Zvc3Rlci1kZXYtd2ViLWNsaWVudCcsXG4gICAgICBhdXRoRmxvd3M6IHtcbiAgICAgICAgdXNlclBhc3N3b3JkOiB0cnVlLFxuICAgICAgICB1c2VyU3JwOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGdlbmVyYXRlU2VjcmV0OiBmYWxzZSxcbiAgICAgIG9BdXRoOiB7XG4gICAgICAgIGZsb3dzOiB7XG4gICAgICAgICAgYXV0aG9yaXphdGlvbkNvZGVHcmFudDogdHJ1ZSxcbiAgICAgICAgICBpbXBsaWNpdENvZGVHcmFudDogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgc2NvcGVzOiBbXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLkVNQUlMLFxuICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5PUEVOSUQsXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLlBST0ZJTEUsXG4gICAgICAgIF0sXG4gICAgICAgIGNhbGxiYWNrVXJsczogW1xuICAgICAgICAgIGBodHRwczovLyR7ZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9L2NhbGxiYWNrYCxcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDo1MTczL2NhbGxiYWNrJyxcbiAgICAgICAgXSxcbiAgICAgICAgbG9nb3V0VXJsczogW1xuICAgICAgICAgIGBodHRwczovLyR7ZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDo1MTczJyxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBDb2duaXRvIERvbWFpbiBmb3IgSG9zdGVkIFVJXG4gICAgY29uc3QgY29nbml0b0RvbWFpbiA9IG5ldyBjb2duaXRvLlVzZXJQb29sRG9tYWluKHRoaXMsICdVc2VyUG9vbERvbWFpbicsIHtcbiAgICAgIHVzZXJQb29sLFxuICAgICAgY29nbml0b0RvbWFpbjoge1xuICAgICAgICBkb21haW5QcmVmaXg6IHByb3BzLmhvc3RlZFVpUHJlZml4LFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFN0YWNrIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udFVSTCcsIHtcbiAgICAgIHZhbHVlOiBgaHR0cHM6Ly8ke2Rpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lfWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERvbWFpbk5hbWUnLCB7XG4gICAgICB2YWx1ZTogZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERpc3RyaWJ1dGlvbklkJywge1xuICAgICAgdmFsdWU6IGRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25JZCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTaXRlQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiBzaXRlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpVXJsJywge1xuICAgICAgdmFsdWU6IGh0dHBBcGkudXJsISxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbElkJywge1xuICAgICAgdmFsdWU6IHVzZXJQb29sLnVzZXJQb29sSWQsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvZ25pdG9Eb21haW4nLCB7XG4gICAgICB2YWx1ZTogYCR7cHJvcHMuaG9zdGVkVWlQcmVmaXh9LmF1dGguJHt0aGlzLnJlZ2lvbn0uYW1hem9uY29nbml0by5jb21gLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0IHRhYmxlIG5hbWVzIGZvciB2ZXJpZmljYXRpb25cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU3R1ZGVudHNUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogc3R1ZGVudHNUYWJsZS50YWJsZU5hbWUsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUGFyZW50c1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiBwYXJlbnRzVGFibGUudGFibGVOYW1lLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RyYW5zYWN0aW9uc1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0cmFuc2FjdGlvbnNUYWJsZS50YWJsZU5hbWUsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==