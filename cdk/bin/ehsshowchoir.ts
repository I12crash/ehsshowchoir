#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EhsShowchoirStack } from '../lib/ehsshowchoir-stack';

const app = new cdk.App();

new EhsShowchoirStack(app, 'EhsShowchoirStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-2',
  },
  description: 'EHS Show Choir Payment System Infrastructure',
  tags: {
    Project: 'EHS Show Choir',
    Environment: 'production',
    Owner: 'EHS Show Choir Team',
  },
});

app.synth();