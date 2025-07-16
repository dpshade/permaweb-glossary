import { SearchProvider } from './search-provider.js';
import { searchConfig } from './search-config.js';
import { permawebConfig, getDocsIndexUrls, getLLMTextFileUrls, debugLog } from './permaweb-config.js';

// Always use bundled FlexSearch for consistency across all environments
async function getFlexSearch() {
    if (typeof window !== 'undefined' && window.FlexSearch) {
        return { Document: window.FlexSearch.Document };
    } else {
        // Load the bundled version
        await import('./flexsearch.bundle.min.js');
        return { Document: window.FlexSearch.Document };
    }
}

function fetchWithTimeout(url, options = {}) {
    const { timeout = permawebConfig.network.timeout, ...fetchOptions } = options;
    return Promise.race([
        fetch(url, fetchOptions),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)
        )
    ]);
}

class DocsPage {
    constructor(data) {
        this.url = data.url;
        this.title = data.title;
        this.siteKey = data.siteKey;
        this.siteName = data.siteName;
        this.content = data.content || '';
        this.fullContent = data.fullContent || '';
        this.breadcrumbs = data.breadcrumbs || [];
        this.estimatedWords = data.estimatedWords || 0;
        this.lastModified = data.lastModified;
        this.crawledAt = data.crawledAt;
        this.depth = data.depth;
    }
}

class SearchResult extends DocsPage {
    constructor(page, score, snippet) {
        super(page);
        this.score = score;
        this.snippet = snippet;
    }
}

export class EnhancedSearchProvider extends SearchProvider {
    constructor() {
        super();
        this.docsData = [];
        this.docsIndex = null;
        this.docsUnavailable = false;
        this.contentCache = new Map(); // Cache for LLM text content
    }

    async initialize() {
        try {
            await this._loadDocsData();
            this.initialized = true;
            return true;
        } catch (error) {
            console.warn('Enhanced documentation search unavailable:', error.message);
            this.docsUnavailable = true;
            return false;
        }
    }

    async search(query) {
        if (this.docsUnavailable || !this.docsIndex) {
            console.warn('Documentation search is unavailable.');
            return [];
        }

        const results = await this.docsIndex.search(query, {
            limit: 20,
            suggest: true
        });
        
        return this._processDocumentationResults(results, query);
    }

    destroy() {
        this.docsData = [];
        this.docsIndex = null;
        this.docsUnavailable = false;
        this.contentCache.clear();
        this.initialized = false;
    }

    async _loadDocsData() {
        try {
            let response;
            let docsIndex;
            
            const indexUrls = getDocsIndexUrls();
            debugLog('network', 'Loading docs index from:', indexUrls.primary);
            
            try {
                response = await fetchWithTimeout(indexUrls.primary, { 
                    timeout: permawebConfig.network.timeout,
                    headers: { 'User-Agent': permawebConfig.network.userAgent }
                });
                if (!response.ok) throw new Error(`Primary source failed: ${response.status}`);
                docsIndex = await response.json();
            } catch (primaryError) {
                debugLog('network', 'Primary docs index failed, trying fallback...', primaryError);
                response = await fetchWithTimeout(indexUrls.fallback, { 
                    timeout: permawebConfig.network.timeout,
                    headers: { 'User-Agent': permawebConfig.network.userAgent }
                });
                if (!response.ok) throw new Error(`Fallback source also failed: ${response.status}`);
                docsIndex = await response.json();
            }
            
            await this._processDocumentationDataWithLLMText(docsIndex);
            await this._createDocumentationIndex();
        } catch (error) {
            this.docsData = [];
            this.docsIndex = null;
            this.docsUnavailable = true;
            throw new Error(`Documentation loading failed: ${error.message}`);
        }
    }

    async _processDocumentationDataWithLLMText(docsIndex) {
        console.log('Loading pre-extracted content from LLM text files...');
        
        // Load LLM text files for all sites
        const siteContents = await this._loadLLMTextFiles();
        
        // Process documentation data with pre-extracted content
        this.docsData = [];
        const sites = docsIndex.sites || {};
        
        for (const [siteKey, siteData] of Object.entries(sites)) {
            if (siteKey === "_metadata" || siteKey === "generated") continue;
            if (siteData.pages && Array.isArray(siteData.pages)) {
                
                const siteContent = siteContents.get(siteKey) || new Map();
                
                for (const page of siteData.pages) {
                    const estimatedWords = page.estimatedWords || Math.max(300, page.title.length * 15);
                    const searchableContent = [
                        page.title, page.breadcrumbs?.join(' ') || '',
                        siteData.name, page.url.split('/').pop()?.replace(/\.(html|md)$/, '') || ''
                    ].filter(Boolean).join(' ');
                    
                    // Get pre-extracted content from LLM text files
                    const fullContent = siteContent.get(page.url) || '';
                    
                    const pageData = {
                        ...page, 
                        siteKey, 
                        siteName: siteData.name, 
                        estimatedWords, 
                        content: searchableContent,
                        fullContent: fullContent.substring(0, permawebConfig.content.maxLength) // Limit content size
                    };
                    
                    this.docsData.push(new DocsPage(pageData));
                }
            }
        }
        
        console.log(`Indexed ${this.docsData.length} documentation pages using pre-extracted content.`);
    }

    async _loadLLMTextFiles() {
        const siteContents = new Map();
        
        try {
            const llmTextUrls = await getLLMTextFileUrls();
            
            debugLog('network', 'Loading LLM text files for sites:', Object.keys(llmTextUrls));
            
            // Load LLM text files in parallel
            const loadPromises = Object.entries(llmTextUrls).map(async ([siteKey, urls]) => {
                try {
                    let response;
                    try {
                        debugLog('network', `Loading ${siteKey} from:`, urls.primary);
                        response = await fetchWithTimeout(urls.primary, { 
                            timeout: permawebConfig.network.timeout,
                            headers: { 'User-Agent': permawebConfig.network.userAgent }
                        });
                        if (!response.ok) throw new Error(`Primary LLM file failed: ${response.status}`);
                    } catch (primaryError) {
                        debugLog('network', `Primary LLM file failed for ${siteKey}, trying fallback...`);
                        response = await fetchWithTimeout(urls.fallback, { 
                            timeout: permawebConfig.network.timeout,
                            headers: { 'User-Agent': permawebConfig.network.userAgent }
                        });
                        if (!response.ok) throw new Error(`Fallback LLM file also failed: ${response.status}`);
                    }
                    
                    const text = await response.text();
                    const contentMap = this._parseLLMTextFile(text);
                    siteContents.set(siteKey, contentMap);
                    debugLog('content', `Loaded ${contentMap.size} documents from ${siteKey} LLM text file`);
                    
                } catch (error) {
                    console.warn(`Failed to load LLM text file for ${siteKey}:`, error.message);
                    siteContents.set(siteKey, new Map());
                }
            });
            
            await Promise.allSettled(loadPromises);
            
        } catch (error) {
            console.warn('Failed to get LLM text file URLs, falling back to empty content:', error.message);
            debugLog('network', 'Site discovery failed completely:', error);
        }
        
        return siteContents;
    }

    _parseLLMTextFile(text) {
        const contentMap = new Map();
        
        // Parse the LLM text file format which contains documents separated by "---"
        const sections = text.split(/^---$/m);
        
        for (const section of sections) {
            const lines = section.trim().split('\n');
            let url = '';
            let content = '';
            let inContent = false;
            
            for (const line of lines) {
                if (line.startsWith('Source: ')) {
                    url = line.replace('Source: ', '').trim();
                } else if (line.startsWith('# ') && url) {
                    // Start of actual content after metadata
                    inContent = true;
                    content += line + '\n';
                } else if (inContent) {
                    content += line + '\n';
                } else if (line.startsWith('Document Number:') || 
                          line.startsWith('Words:') || 
                          line.startsWith('Quality Score:') ||
                          line.startsWith('Extraction Method:') ||
                          line.startsWith('Extraction Reason:')) {
                    // Skip metadata lines
                    continue;
                }
            }
            
            if (url && content.trim()) {
                contentMap.set(url, content.trim());
            }
        }
        
        return contentMap;
    }

    async _createDocumentationIndex() {
        // Get FlexSearch Document class (handles dev/prod environments)
        const { Document } = await getFlexSearch();
        
        this.docsIndex = new Document({
            document: {
                id: "url",
                index: [
                    { field: "title", tokenize: "forward", resolution: 9 },
                    { field: "content", tokenize: "forward", resolution: 5 },
                    { field: "fullContent", tokenize: "forward", resolution: 4 },
                    { field: "siteName", tokenize: "forward", resolution: 7 }
                ],
                store: true
            },
            tokenize: "forward",
            cache: 100
        });

        this.docsData.forEach(page => {
            this.docsIndex.add(page);
        });

        console.log(`Documentation search index created with ${this.docsData.length} pages.`);
    }

    _processDocumentationResults(results, query) {
        const resultMap = new Map();
        const queryLower = query.toLowerCase();
        
        results.forEach(resultSet => {
            if (resultSet && resultSet.result && Array.isArray(resultSet.result)) {
                resultSet.result.forEach((url) => {
                    const page = this.docsData.find(p => p.url === url);
                    if (page && !resultMap.has(url)) {
                        const score = this._calculateRelevanceScore(page, queryLower, resultSet.field);
                        const snippet = this._generateSnippet(page, queryLower);
                        resultMap.set(url, new SearchResult(page, score, snippet));
                    }
                });
            }
        });
        
        return Array.from(resultMap.values()).sort((a, b) => b.score - a.score).slice(0, 10);
    }

    _calculateRelevanceScore(page, query, field) {
        let score = 0;
        const queryTerms = query.split(/\s+/).filter(term => term.length > 1);
        
        // Base score from field type
        const fieldWeights = {
            'title': 10,
            'content': 3,
            'fullContent': 2,
            'siteName': 1
        };
        
        const fieldWeight = fieldWeights[field] || 1;
        
        // Check for exact matches and partial matches
        queryTerms.forEach(term => {
            const termLower = term.toLowerCase();
            
            // Title matches (highest weight)
            if (page.title.toLowerCase().includes(termLower)) {
                score += fieldWeight * 10;
                if (page.title.toLowerCase() === termLower) {
                    score += fieldWeight * 20; // Exact title match
                }
            }
            
            // Content matches (medium weight)
            if (page.content.toLowerCase().includes(termLower)) {
                score += fieldWeight * 3;
            }
            
            // Full content matches (lower weight but important for comprehensive search)
            if (page.fullContent.toLowerCase().includes(termLower)) {
                score += fieldWeight * 1;
                // Boost score if term appears multiple times in content
                const matches = (page.fullContent.toLowerCase().match(new RegExp(termLower, 'g')) || []).length;
                if (matches > 1) {
                    score += Math.min(matches * 0.5, 5); // Cap the boost
                }
            }
            
            // Site name matches
            if (page.siteName.toLowerCase().includes(termLower)) {
                score += fieldWeight * 2;
            }
        });
        
        // Boost score for newer content
        if (page.lastModified) {
            const daysSinceModified = (Date.now() - new Date(page.lastModified).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceModified < 30) {
                score += 2; // Boost recent content
            }
        }
        
        // Normalize by estimated reading length
        if (page.estimatedWords > 0) {
            score = score * Math.min(1, 1000 / page.estimatedWords); // Prefer concise, relevant content
        }
        
        return score;
    }

    _generateSnippet(page, query) {
        const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 1);
        
        // Try to find the best snippet from full content first
        if (page.fullContent) {
            const snippetFromContent = this._findBestSnippet(page.fullContent, queryTerms);
            if (snippetFromContent) {
                return snippetFromContent;
            }
        }
        
        // Fallback to basic content
        const snippetFromBasic = this._findBestSnippet(page.content, queryTerms);
        if (snippetFromBasic) {
            return snippetFromBasic;
        }
        
        // Ultimate fallback to title + basic description
        return page.title + (page.breadcrumbs ? ' - ' + page.breadcrumbs.join(' › ') : '');
    }

    _findBestSnippet(text, queryTerms) {
        if (!text) return '';
        
        const snippetLength = 150;
        const textLower = text.toLowerCase();
        
        // Find the position of the first query term
        let bestPosition = -1;
        let bestTerm = '';
        
        for (const term of queryTerms) {
            const position = textLower.indexOf(term.toLowerCase());
            if (position !== -1 && (bestPosition === -1 || position < bestPosition)) {
                bestPosition = position;
                bestTerm = term;
            }
        }
        
        if (bestPosition === -1) {
            // No query terms found, return beginning of text
            return text.substring(0, snippetLength) + (text.length > snippetLength ? '...' : '');
        }
        
        // Create snippet around the found term
        const start = Math.max(0, bestPosition - 50);
        const end = Math.min(text.length, start + snippetLength);
        
        let snippet = text.substring(start, end);
        
        // Add ellipsis if we're not at the beginning/end
        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';
        
        return snippet.trim();
    }

    async search(query) {
        if (!this.initialized || this.docsUnavailable || !this.docsIndex) {
            return [];
        }

        try {
            const results = this.docsIndex.search(query);
            return this._processDocumentationResults(results, query);
        } catch (error) {
            console.error('Documentation search error:', error);
            return [];
        }
    }
} 