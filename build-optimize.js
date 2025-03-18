#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';

// File paths
const paths = {
  json: {
    src: 'src/data/glossary.json',
    dist: 'dist/src/data/glossary.json'
  },
  js: 'dist/src/js/main.js',
  css: 'dist/src/css/style.css'
};

// Detect if we're in deploy mode
const isDeployment = process.argv.includes('--deploy');

// Ensure dist directories exist
ensureDir(path.dirname(paths.json.dist));

// Step 1: Minify JSON
console.log('=== Minifying Files ===');
minifyJson(paths.json.src, paths.json.dist);

// Step 2: Compress all assets
console.log('\n=== Compressing Files with gzip ===');
const filesToCompress = [
  paths.js,
  paths.css,
  paths.json.dist
];

for (const filePath of filesToCompress) {
  compressFile(filePath, isDeployment);
}

// Function to minify JSON
function minifyJson(srcPath, destPath) {
  console.log(`Minifying ${srcPath}...`);
  
  try {
    const originalSize = fs.statSync(srcPath).size;
    const data = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
    
    // Minify by stringifying without whitespace
    const minified = JSON.stringify(data);
    fs.writeFileSync(destPath, minified);
    const minifiedSize = fs.statSync(destPath).size;
    
    const reduction = ((originalSize - minifiedSize) / originalSize * 100).toFixed(2);
    console.log(`JSON minified: ${originalSize.toLocaleString()} bytes → ${minifiedSize.toLocaleString()} bytes (${reduction}% reduction)`);
  } catch (error) {
    console.error(`Error minifying JSON: ${error.message}`);
    process.exit(1);
  }
}

// Function to compress a file with gzip
function compressFile(filePath, isDeployment) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: ${filePath} not found, skipping...`);
    return;
  }

  try {
    const originalSize = fs.statSync(filePath).size;
    const content = fs.readFileSync(filePath);
    const compressed = gzipSync(content);
    
    // Write compressed version
    const gzipPath = `${filePath}.gz`;
    fs.writeFileSync(gzipPath, compressed);
    const compressedSize = fs.statSync(gzipPath).size;
    
    const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
    console.log(`${path.basename(filePath)}: ${originalSize.toLocaleString()} bytes → ${compressedSize.toLocaleString()} bytes (${reduction}% reduction)`);
    
    // For deployment, we should clean up old .br files
    if (isDeployment) {
      const brPath = `${filePath}.br`;
      if (fs.existsSync(brPath)) {
        fs.unlinkSync(brPath);
        console.log(`Removed old Brotli file: ${brPath}`);
      }
    }
  } catch (error) {
    console.error(`Error compressing ${filePath}: ${error.message}`);
  }
}

// Function to ensure directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
} 