#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { CoreStack } from '../lib/core-stack.js';

const app = new App();
new CoreStack(app, 'ShowChoirBillingStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'us-east-2' },
});
