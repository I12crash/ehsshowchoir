#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EhsShowchoirStack } from '../lib/ehsshowchoir-stack';

const app = new cdk.App();

// Configuration
const domainName = app.node.tryGetContext('domainName') || process.env.DOMAIN_NAME || 'edgewoodshowchoirpayments.org';
const certificateArn = app.node.tryGetContext('certificateArn') || process.env.CERTIFICATE_ARN;

// Main stack
new EhsShowchoirStack(app, 'EhsShowchoirStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-2',
  },
  domainName,
  certificateArn,
  description: 'EHS Show Choir Payment System - Main Infrastructure',
  tags: {
    Project: 'EhsShowchoir',
    Environment: 'Production',
    Owner: 'EdgewoodShowChoir'
  }
});
