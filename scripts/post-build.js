#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';
import { execSync } from 'child_process';
import { Document } from 'flexsearch';

console.log('🔧 Running post-build optimizations...');

// Clean up any .DS_Store files that might have slipped through
try {
  execSync('find dist -name ".DS_Store" -delete', { stdio: 'ignore' });
} catch (error) {
  // Ignore if no .DS_Store files found
}

// Configuration
const DIST_DIR = 'dist';
const SRC_SCRIPTS_DIR = 'src/scripts';
const DIST_SCRIPTS_DIR = `${DIST_DIR}/scripts`;
const GLOSSARY_SRC = 'public/data/glossary.json';
const GLOSSARY_DIST = `${DIST_DIR}/src/data/glossary.json`;
const GLOSSARY_TXT = `${DIST_DIR}/glossary.txt`;
const FLEXSEARCH_INDEX_DIR = `${DIST_DIR}/flexsearch`;


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

// Step 3: Generate FlexSearch index
console.log('🔍 Generating FlexSearch index...');
const flexsearchFiles = generateFlexSearchIndex();

// Step 4: Compress assets
console.log('📦 Compressing assets...');
compressAssets(flexsearchFiles);

console.log('✅ Post-build optimizations complete!');

/**
 * Generate FlexSearch index from glossary.json
 */
function generateFlexSearchIndex() {
  try {
    const data = JSON.parse(fs.readFileSync(GLOSSARY_SRC, 'utf8'));
    const index = new Document({
      document: {
        id: 'term',
        index: ['term', 'definition', 'aliases', 'related'],
        store: ['term', 'definition', 'category', 'aliases', 'related', 'docs']
      }
    });

    data.terms.forEach(entry => {
      index.add(entry);
    });

    // Ensure flexsearch directory exists
    if (!fs.existsSync(FLEXSEARCH_INDEX_DIR)) {
      fs.mkdirSync(FLEXSEARCH_INDEX_DIR, { recursive: true });
    }

    const generatedFiles = [];
    // Export and save the index
    index.export((key, data) => {
      const filePath = path.join(FLEXSEARCH_INDEX_DIR, key + '.json');
      fs.writeFileSync(filePath, data, 'utf8');
      generatedFiles.push(filePath);
    });
    console.log(`   ✓ Generated FlexSearch index files.`);
    return generatedFiles;

  } catch (error) {
    console.error(`❌ Error generating FlexSearch index: ${error.message}`);
    process.exit(1);
  }
}



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
function compressAssets(additionalFiles = []) {
  const astroJsFiles = fs.readdirSync(path.join(DIST_DIR, '_astro')).filter(f => f.endsWith('.js')).map(f => path.join(DIST_DIR, '_astro', f));
  const filesToCompress = [
    ...astroJsFiles,
    `${DIST_DIR}/service-worker.js`,
    GLOSSARY_DIST,
    GLOSSARY_TXT,
    ...additionalFiles
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