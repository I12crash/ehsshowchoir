#!/usr/bin/env node
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const foster_dev_stack_1 = require("../lib/foster-dev-stack");
const app = new cdk.App();
const hostedUiPrefix = process.env.HOSTED_UI_PREFIX || 'foster-dev-auth';
new foster_dev_stack_1.FosterDevStack(app, 'FosterDevStack', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'us-east-2',
    },
    hostedUiPrefix,
    crossRegionReferences: true,
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZm9zdGVyLWRldi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImZvc3Rlci1kZXYudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFDQSx1Q0FBcUM7QUFDckMsaURBQW1DO0FBQ25DLDhEQUF5RDtBQUV6RCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixJQUFJLGlCQUFpQixDQUFDO0FBRXpFLElBQUksaUNBQWMsQ0FBQyxHQUFHLEVBQUUsZ0JBQWdCLEVBQUU7SUFDeEMsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVc7S0FDdEQ7SUFDRCxjQUFjO0lBQ2QscUJBQXFCLEVBQUUsSUFBSTtDQUM1QixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgRm9zdGVyRGV2U3RhY2sgfSBmcm9tICcuLi9saWIvZm9zdGVyLWRldi1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbmNvbnN0IGhvc3RlZFVpUHJlZml4ID0gcHJvY2Vzcy5lbnYuSE9TVEVEX1VJX1BSRUZJWCB8fCAnZm9zdGVyLWRldi1hdXRoJztcblxubmV3IEZvc3RlckRldlN0YWNrKGFwcCwgJ0Zvc3RlckRldlN0YWNrJywge1xuICBlbnY6IHtcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8ICd1cy1lYXN0LTInLFxuICB9LFxuICBob3N0ZWRVaVByZWZpeCxcbiAgY3Jvc3NSZWdpb25SZWZlcmVuY2VzOiB0cnVlLFxufSk7XG4iXX0=