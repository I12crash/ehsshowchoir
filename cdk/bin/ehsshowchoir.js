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
new ehsshowchoir_stack_1.EhsShowchoirStack(app, 'EhsShowchoirStack', {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWhzc2hvd2Nob2lyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZWhzc2hvd2Nob2lyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyxrRUFBOEQ7QUFFOUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsSUFBSSxzQ0FBaUIsQ0FBQyxHQUFHLEVBQUUsbUJBQW1CLEVBQUU7SUFDOUMsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxXQUFXO0tBQ3BCO0lBQ0QsV0FBVyxFQUFFLDhDQUE4QztJQUMzRCxJQUFJLEVBQUU7UUFDSixPQUFPLEVBQUUsZ0JBQWdCO1FBQ3pCLFdBQVcsRUFBRSxZQUFZO1FBQ3pCLEtBQUssRUFBRSxxQkFBcUI7S0FDN0I7Q0FDRixDQUFDLENBQUM7QUFFSCxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgRWhzU2hvd2Nob2lyU3RhY2sgfSBmcm9tICcuLi9saWIvZWhzc2hvd2Nob2lyLXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxubmV3IEVoc1Nob3djaG9pclN0YWNrKGFwcCwgJ0Voc1Nob3djaG9pclN0YWNrJywge1xuICBlbnY6IHtcbiAgICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICAgIHJlZ2lvbjogJ3VzLWVhc3QtMicsXG4gIH0sXG4gIGRlc2NyaXB0aW9uOiAnRUhTIFNob3cgQ2hvaXIgUGF5bWVudCBTeXN0ZW0gSW5mcmFzdHJ1Y3R1cmUnLFxuICB0YWdzOiB7XG4gICAgUHJvamVjdDogJ0VIUyBTaG93IENob2lyJyxcbiAgICBFbnZpcm9ubWVudDogJ3Byb2R1Y3Rpb24nLFxuICAgIE93bmVyOiAnRUhTIFNob3cgQ2hvaXIgVGVhbScsXG4gIH0sXG59KTtcblxuYXBwLnN5bnRoKCk7Il19