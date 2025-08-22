import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
interface EhsShowchoirStackProps extends cdk.StackProps {
    domainName?: string;
    certificateArn?: string;
}
export declare class EhsShowchoirStack extends cdk.Stack {
    readonly distribution: cloudfront.Distribution;
    readonly api: apigateway.RestApi;
    readonly userPool: cognito.UserPool;
    constructor(scope: Construct, id: string, props?: EhsShowchoirStackProps);
}
export {};
