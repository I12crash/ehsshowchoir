#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FosterDevStack } from '../lib/foster-dev-stack';

const app = new cdk.App();

const hostedUiPrefix = process.env.HOSTED_UI_PREFIX || 'foster-dev-auth';

new FosterDevStack(app, 'FosterDevStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-2',
  },
  hostedUiPrefix,
  crossRegionReferences: true,
});
