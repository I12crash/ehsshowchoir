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
const ehsshowchoir_stack_1 = require("../lib/ehsshowchoir-stack");
const app = new cdk.App();
// Configuration
const domainName = app.node.tryGetContext('domainName') || process.env.DOMAIN_NAME || 'edgewoodshowchoirpayments.org';
const certificateArn = app.node.tryGetContext('certificateArn') || process.env.CERTIFICATE_ARN;
// Main stack
new ehsshowchoir_stack_1.EhsShowchoirStack(app, 'EhsShowchoirStack', {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWhzc2hvd2Nob2lyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZWhzc2hvd2Nob2lyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyxrRUFBOEQ7QUFFOUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsZ0JBQWdCO0FBQ2hCLE1BQU0sVUFBVSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsV0FBVyxJQUFJLCtCQUErQixDQUFDO0FBQ3RILE1BQU0sY0FBYyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUM7QUFFL0YsYUFBYTtBQUNiLElBQUksc0NBQWlCLENBQUMsR0FBRyxFQUFFLG1CQUFtQixFQUFFO0lBQzlDLEdBQUcsRUFBRTtRQUNILE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtRQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0tBQ3REO0lBQ0QsVUFBVTtJQUNWLGNBQWM7SUFDZCxXQUFXLEVBQUUscURBQXFEO0lBQ2xFLElBQUksRUFBRTtRQUNKLE9BQU8sRUFBRSxjQUFjO1FBQ3ZCLFdBQVcsRUFBRSxZQUFZO1FBQ3pCLEtBQUssRUFBRSxtQkFBbUI7S0FDM0I7Q0FDRixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgRWhzU2hvd2Nob2lyU3RhY2sgfSBmcm9tICcuLi9saWIvZWhzc2hvd2Nob2lyLXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuLy8gQ29uZmlndXJhdGlvblxuY29uc3QgZG9tYWluTmFtZSA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ2RvbWFpbk5hbWUnKSB8fCBwcm9jZXNzLmVudi5ET01BSU5fTkFNRSB8fCAnZWRnZXdvb2RzaG93Y2hvaXJwYXltZW50cy5vcmcnO1xuY29uc3QgY2VydGlmaWNhdGVBcm4gPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdjZXJ0aWZpY2F0ZUFybicpIHx8IHByb2Nlc3MuZW52LkNFUlRJRklDQVRFX0FSTjtcblxuLy8gTWFpbiBzdGFja1xubmV3IEVoc1Nob3djaG9pclN0YWNrKGFwcCwgJ0Voc1Nob3djaG9pclN0YWNrJywge1xuICBlbnY6IHtcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICAgIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8ICd1cy1lYXN0LTInLFxuICB9LFxuICBkb21haW5OYW1lLFxuICBjZXJ0aWZpY2F0ZUFybixcbiAgZGVzY3JpcHRpb246ICdFSFMgU2hvdyBDaG9pciBQYXltZW50IFN5c3RlbSAtIE1haW4gSW5mcmFzdHJ1Y3R1cmUnLFxuICB0YWdzOiB7XG4gICAgUHJvamVjdDogJ0Voc1Nob3djaG9pcicsXG4gICAgRW52aXJvbm1lbnQ6ICdQcm9kdWN0aW9uJyxcbiAgICBPd25lcjogJ0VkZ2V3b29kU2hvd0Nob2lyJ1xuICB9XG59KTtcbiJdfQ==