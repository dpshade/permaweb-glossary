#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';

console.log('🔧 Running post-build optimizations...');

// Configuration
const DIST_DIR = 'dist';
const GLOSSARY_SRC = 'src/data/glossary.json';
const GLOSSARY_DIST = `${DIST_DIR}/src/data/glossary.json`;
const GLOSSARY_TXT = `${DIST_DIR}/glossary.txt`;

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ Dist directory not found. Run build first.');
  process.exit(1);
}

// Step 1: Generate glossary.txt
console.log('📝 Generating glossary.txt...');
generateGlossaryTxt();

// Step 2: Minify JSON
console.log('🗜️  Minifying JSON...');
minifyGlossaryJson();

// Step 3: Compress assets
console.log('📦 Compressing assets...');
compressAssets();

console.log('✅ Post-build optimizations complete!');

/**
 * Generate glossary.txt from glossary.json
 */
function generateGlossaryTxt() {
  try {
    const data = JSON.parse(fs.readFileSync(GLOSSARY_SRC, 'utf8'));
    
    if (!data.terms || !Array.isArray(data.terms)) {
      throw new Error('Invalid glossary format: expected "terms" array');
    }
    
    let content = '';
    let processedCount = 0;
    
    data.terms.forEach((entry, index) => {
      if (entry.term && entry.definition) {
        content += `${entry.term}: ${entry.definition}`;
        if (index < data.terms.length - 1) {
          content += '\n\n';
        }
        processedCount++;
      } else {
        console.warn(`⚠️  Skipping entry ${index + 1} - missing term or definition`);
      }
    });
    
    fs.writeFileSync(GLOSSARY_TXT, content, 'utf8');
    const fileSize = fs.statSync(GLOSSARY_TXT).size;
    console.log(`   ✓ Generated glossary.txt: ${processedCount} terms, ${formatBytes(fileSize)}`);
    
  } catch (error) {
    console.error(`❌ Error generating glossary.txt: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Minify the glossary JSON
 */
function minifyGlossaryJson() {
  try {
    const originalSize = fs.statSync(GLOSSARY_SRC).size;
    const data = JSON.parse(fs.readFileSync(GLOSSARY_SRC, 'utf8'));
    
    // Ensure dist directory exists
    const distDir = path.dirname(GLOSSARY_DIST);
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    
    const minified = JSON.stringify(data);
    fs.writeFileSync(GLOSSARY_DIST, minified);
    const minifiedSize = fs.statSync(GLOSSARY_DIST).size;
    
    const reduction = ((originalSize - minifiedSize) / originalSize * 100).toFixed(1);
    console.log(`   ✓ Minified JSON: ${formatBytes(originalSize)} → ${formatBytes(minifiedSize)} (${reduction}% reduction)`);
    
  } catch (error) {
    console.error(`❌ Error minifying JSON: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Compress all assets with gzip
 */
function compressAssets() {
  const filesToCompress = [
    `${DIST_DIR}/src/js/main.js`,
    `${DIST_DIR}/src/css/style.css`,
    `${DIST_DIR}/src/js/keyboard-nav.js`,
    `${DIST_DIR}/service-worker.js`,
    GLOSSARY_DIST,
    GLOSSARY_TXT
  ];

  filesToCompress.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        const originalSize = fs.statSync(filePath).size;
        const content = fs.readFileSync(filePath);
        const compressed = gzipSync(content);
        
        fs.writeFileSync(`${filePath}.gz`, compressed);
        const compressedSize = fs.statSync(`${filePath}.gz`).size;
        
        const reduction = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
        const fileName = path.basename(filePath);
        console.log(`   ✓ Compressed ${fileName}: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${reduction}% reduction)`);
        
      } catch (error) {
        console.error(`❌ Error compressing ${filePath}: ${error.message}`);
      }
    } else {
      console.warn(`⚠️  File not found: ${filePath}`);
    }
  });
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
} 