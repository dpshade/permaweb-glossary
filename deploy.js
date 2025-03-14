#!/usr/bin/env bun

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Run the build command
async function runBuild() {
  return new Promise((resolve, reject) => {
    console.log('Running build...');
    const buildProcess = spawn('bun', ['run', 'build'], { stdio: 'inherit' });
    
    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log('Build completed successfully');
        resolve();
      } else {
        console.error(`Build failed with code ${code}`);
        reject(new Error(`Build failed with code ${code}`));
      }
    });
  });
}

// Run the deploy command
async function runDeploy(isStaging = false) {
  return new Promise((resolve, reject) => {
    const args = [
      'permaweb-deploy', 
      '--ant-process', 
      process.env.ANT_PROCESS,
    ];
    
    if (isStaging) {
      args.push('--env', 'staging');
    }
    
    console.log(`Running deployment with command: bun ${args.join(' ')}`);
    console.log(`Using ANT_PROCESS: ${process.env.ANT_PROCESS}`);
    console.log(`DEPLOY_KEY is ${process.env.DEPLOY_KEY ? 'set' : 'not set'}`);
    
    const deployProcess = spawn('bun', args, { 
      stdio: 'inherit',
      env: process.env
    });
    
    deployProcess.on('close', (code) => {
      if (code === 0) {
        console.log('Deployment completed successfully');
        resolve();
      } else {
        console.error(`Deployment failed with code ${code}`);
        reject(new Error(`Deployment failed with code ${code}`));
      }
    });
  });
}

// Main function
async function main() {
  try {
    // Check if DEPLOY_KEY is set
    if (!process.env.DEPLOY_KEY) {
      throw new Error('DEPLOY_KEY environment variable is not set');
    }
    
    // Check if ANT_PROCESS is set
    if (!process.env.ANT_PROCESS) {
      throw new Error('ANT_PROCESS environment variable is not set');
    }
    
    console.log('Environment variables loaded:');
    console.log(`- ANT_PROCESS: ${process.env.ANT_PROCESS}`);
    console.log('- DEPLOY_KEY: [present but not shown for security]');
    
    // Determine if staging deployment
    const isStaging = process.argv.includes('--staging');
    
    // Run build
    await runBuild();
    
    // Run deploy
    await runDeploy(isStaging);
    
    console.log('Deployment process completed successfully');
  } catch (error) {
    console.error('Deployment process failed:', error.message);
    process.exit(1);
  }
}

// Run the main function
main(); 