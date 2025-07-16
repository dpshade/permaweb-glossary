#!/usr/bin/env bun

/**
 * Sync script to leverage permaweb-llm-fuel data for the glossary
 * This script creates an optimized documentation index with pre-extracted content
 */

import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const PERMAWEB_LLM_FUEL_DIR = '../permaweb-llm-fuel';
const OUTPUT_DIR = './public';

class PermawebDataSyncer {
    constructor() {
        this.docsIndex = null;
        this.llmContents = new Map();
        this.outputIndex = {
            generated: new Date().toISOString(),
            sites: {},
            enhancedContent: true // Flag to indicate pre-extracted content is included
        };
    }

    async sync() {
        console.log('🔄 Starting Permaweb LLM data sync...');
        
        try {
            // 1. Load the docs index from permaweb-llm-fuel
            await this.loadDocsIndex();
            
            // 2. Load LLM text files with extracted content
            await this.loadLLMTextFiles();
            
            // 3. Create enhanced index with pre-extracted content
            await this.createEnhancedIndex();
            
            // 4. Write enhanced index to glossary public directory
            await this.writeEnhancedIndex();
            
            console.log('✅ Sync completed successfully!');
            console.log(`📊 Enhanced ${Object.keys(this.outputIndex.sites).length} sites with pre-extracted content`);
            
        } catch (error) {
            console.error('❌ Sync failed:', error.message);
            process.exit(1);
        }
    }

    async loadDocsIndex() {
        const indexPath = join(PERMAWEB_LLM_FUEL_DIR, 'public/docs-index.json');
        
        if (!existsSync(indexPath)) {
            throw new Error(`Docs index not found at ${indexPath}. Make sure permaweb-llm-fuel is built.`);
        }
        
        const indexContent = await readFile(indexPath, 'utf-8');
        this.docsIndex = JSON.parse(indexContent);
        console.log(`📖 Loaded docs index with ${Object.keys(this.docsIndex.sites).length} sites`);
    }

    async loadLLMTextFiles() {
        const llmFiles = [
            'hyperbeam-llms.txt',
            'ao-llms.txt',
            'ario-llms.txt',
            'arweave-llms.txt',
            'permaweb-glossary-llms.txt'
        ];

        for (const filename of llmFiles) {
            const filePath = join(PERMAWEB_LLM_FUEL_DIR, 'public', filename);
            const siteKey = filename.replace('-llms.txt', '');
            
            if (existsSync(filePath)) {
                try {
                    const content = await readFile(filePath, 'utf-8');
                    const contentMap = this.parseLLMTextFile(content);
                    this.llmContents.set(siteKey, contentMap);
                    console.log(`📄 Loaded ${contentMap.size} documents from ${filename}`);
                } catch (error) {
                    console.warn(`⚠️  Failed to load ${filename}:`, error.message);
                }
            } else {
                console.warn(`⚠️  LLM file not found: ${filename}`);
            }
        }
    }

    parseLLMTextFile(text) {
        const contentMap = new Map();
        const sections = text.split(/^---$/m);
        
        for (const section of sections) {
            const lines = section.trim().split('\n');
            let url = '';
            let content = '';
            let metadata = {};
            let inContent = false;
            
            for (const line of lines) {
                if (line.startsWith('Source: ')) {
                    url = line.replace('Source: ', '').trim();
                } else if (line.startsWith('Words: ')) {
                    metadata.words = parseInt(line.replace('Words: ', ''));
                } else if (line.startsWith('Quality Score: ')) {
                    metadata.qualityScore = parseFloat(line.replace('Quality Score: ', ''));
                } else if (line.startsWith('# ') && url) {
                    inContent = true;
                    content += line + '\n';
                } else if (inContent) {
                    content += line + '\n';
                }
            }
            
            if (url && content.trim()) {
                contentMap.set(url, {
                    content: content.trim(),
                    metadata: metadata
                });
            }
        }
        
        return contentMap;
    }

    async createEnhancedIndex() {
        const sites = this.docsIndex.sites || {};
        
        for (const [siteKey, siteData] of Object.entries(sites)) {
            if (siteKey === "_metadata" || siteKey === "generated") continue;
            
            const siteContent = this.llmContents.get(siteKey) || new Map();
            const enhancedPages = [];
            
            if (siteData.pages && Array.isArray(siteData.pages)) {
                for (const page of siteData.pages) {
                    const pageContent = siteContent.get(page.url);
                    
                    const enhancedPage = {
                        ...page,
                        // Add pre-extracted content if available
                        fullContent: pageContent ? pageContent.content.substring(0, 5000) : '', // Consider making this configurable
                        qualityScore: pageContent?.metadata?.qualityScore || 0,
                        enhancedWords: pageContent?.metadata?.words || page.estimatedWords || 0
                    };
                    
                    enhancedPages.push(enhancedPage);
                }
            }
            
            this.outputIndex.sites[siteKey] = {
                ...siteData,
                pages: enhancedPages,
                contentEnhanced: siteContent.size > 0,
                enhancedPageCount: enhancedPages.filter(p => p.fullContent).length
            };
        }
    }

    async writeEnhancedIndex() {
        const outputPath = join(OUTPUT_DIR, 'enhanced-docs-index.json');
        const jsonContent = JSON.stringify(this.outputIndex, null, 2);
        
        await writeFile(outputPath, jsonContent, 'utf-8');
        console.log(`💾 Enhanced index written to ${outputPath}`);
        
        // Also create a minified version for production
        const minifiedPath = join(OUTPUT_DIR, 'enhanced-docs-index.min.json');
        const minifiedContent = JSON.stringify(this.outputIndex);
        await writeFile(minifiedPath, minifiedContent, 'utf-8');
        console.log(`🗜️  Minified index written to ${minifiedPath}`);
    }

    generateSyncReport() {
        const totalSites = Object.keys(this.outputIndex.sites).length;
        const enhancedSites = Object.values(this.outputIndex.sites).filter(s => s.contentEnhanced).length;
        const totalPages = Object.values(this.outputIndex.sites).reduce((sum, site) => sum + site.pages.length, 0);
        const enhancedPages = Object.values(this.outputIndex.sites).reduce((sum, site) => sum + site.enhancedPageCount, 0);
        
        console.log('\n📊 Sync Report:');
        console.log(`   Sites processed: ${totalSites}`);
        console.log(`   Sites with enhanced content: ${enhancedSites}`);
        console.log(`   Total pages: ${totalPages}`);
        console.log(`   Pages with enhanced content: ${enhancedPages}`);
        console.log(`   Enhancement coverage: ${((enhancedPages / totalPages) * 100).toFixed(1)}%`);
    }
}

// Run the sync if this script is executed directly
if (import.meta.main) {
    const syncer = new PermawebDataSyncer();
    await syncer.sync();
    syncer.generateSyncReport();
}

export { PermawebDataSyncer }; 