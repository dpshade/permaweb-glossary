#!/usr/bin/env bun

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Run the build command
async function runBuild() {
  return new Promise((resolve, reject) => {
    console.log('Running build for deployment...');
    
    // First, do the clean and copy steps
    const cleanCopyProcess = spawn('bun', ['run', 'build:clean', '&&', 'bun', 'run', 'build:copy'], { 
      stdio: 'inherit',
      shell: true
    });
    
    cleanCopyProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Clean/copy failed with code ${code}`);
        reject(new Error(`Clean/copy failed with code ${code}`));
        return;
      }
      
      // Then minify JS and CSS
      const minifyProcess = spawn('bun', ['run', 'build:minify:js', '&&', 'bun', 'run', 'build:minify:css', '&&', 'bun', 'run', 'build:minify:keyboard'], {
        stdio: 'inherit',
        shell: true
      });
      
      minifyProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`Minification failed with code ${code}`);
          reject(new Error(`Minification failed with code ${code}`));
          return;
        }
        
        // Finally run the optimizer with the deploy flag
        const optimizeProcess = spawn('bun', ['run', 'build-optimize.js', '--deploy'], {
          stdio: 'inherit'
        });
        
        optimizeProcess.on('close', (code) => {
          if (code === 0) {
            console.log('Build completed successfully');
            resolve();
          } else {
            console.error(`Optimize step failed with code ${code}`);
            reject(new Error(`Optimize step failed with code ${code}`));
          }
        });
      });
    });
  });
}

// Run the deploy command
async function runDeploy(isStaging = false) {
  return new Promise((resolve, reject) => {
    // First, check if compressed files exist and log a warning
    const checkProcess = spawn('find', ['dist', '-name', "*.gz"], { 
      stdio: 'pipe',
      shell: true 
    });
    
    let gzipFiles = '';
    checkProcess.stdout.on('data', (data) => {
      gzipFiles += data.toString();
    });
    
    checkProcess.on('close', (checkCode) => {
      if (gzipFiles.trim()) {
        console.log('Found gzip files that will be included in the deployment:');
        console.log(gzipFiles);
        console.log('Note: These files should have proper Content-Type and Content-Encoding headers.');
      } else {
        console.log('No gzip files found in dist directory. Proceeding with standard deployment.');
      }
      
      // Proceed with deploy
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