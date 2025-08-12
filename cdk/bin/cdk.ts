#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { CoreStack } from '../lib/core-stack.js';

const app = new App();
new CoreStack(app, 'ShowChoirBillingStack', {});
