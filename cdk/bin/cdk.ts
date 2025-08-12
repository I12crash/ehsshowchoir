#!/usr/bin/env node
import 'source-map-support/register.js';
import { App } from 'aws-cdk-lib';
import { CoreStack } from '../lib/core-stack.js';

const app = new App();
new CoreStack(app, 'ShowChoirBillingStack', {});
