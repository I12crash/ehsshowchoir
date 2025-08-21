import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
export interface FosterDevStackProps extends cdk.StackProps {
    hostedUiPrefix: string;
}
export declare class FosterDevStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: FosterDevStackProps);
}
