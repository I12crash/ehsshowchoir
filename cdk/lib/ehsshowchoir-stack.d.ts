import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
export declare class EhsShowchoirStack extends Stack {
    readonly websiteBucket: s3.Bucket;
    readonly invoicesBucket: s3.Bucket;
    readonly distribution: cloudfront.Distribution;
    readonly api: apigateway.RestApi;
    readonly userPool: cognito.UserPool;
    readonly userPoolClient: cognito.UserPoolClient;
    readonly userPoolDomain: cognito.UserPoolDomain;
    readonly studentsTable: dynamodb.Table;
    readonly paymentHistoryTable: dynamodb.Table;
    readonly parentStudentTable: dynamodb.Table;
    readonly invoiceLogTable: dynamodb.Table;
    constructor(scope: Construct, id: string, props?: StackProps);
}
