#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import { brotliCompressSync } from 'zlib';

// File paths
const paths = {
  json: {
    src: 'src/data/glossary.json',
    dist: 'dist/src/data/glossary.json'
  },
  js: 'dist/src/js/main.js',
  css: 'dist/src/css/style.css'
};

// Ensure dist directories exist
ensureDir(path.dirname(paths.json.dist));

// Step 1: Minify JSON
console.log('=== Minifying Files ===');
minifyJson(paths.json.src, paths.json.dist);

// Step 2: Compress all assets
console.log('\n=== Compressing Files ===');
const filesToCompress = [
  paths.js,
  paths.css,
  paths.json.dist
];

for (const filePath of filesToCompress) {
  compressFile(filePath);
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

// Function to compress a file with Brotli
function compressFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: ${filePath} not found, skipping...`);
    return;
  }

  try {
    const originalSize = fs.statSync(filePath).size;
    const content = fs.readFileSync(filePath);
    const compressed = brotliCompressSync(content);
    
    // Write compressed version
    fs.writeFileSync(`${filePath}.br`, compressed);
    const compressedSize = fs.statSync(`${filePath}.br`).size;
    
    const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
    console.log(`${path.basename(filePath)}: ${originalSize.toLocaleString()} bytes → ${compressedSize.toLocaleString()} bytes (${reduction}% reduction)`);
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