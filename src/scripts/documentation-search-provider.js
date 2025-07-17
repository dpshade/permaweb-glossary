import { SearchProvider } from './search-provider.js';
import { searchConfig } from './search-config.js';
import { permawebConfig, getDocsIndexUrls, getLLMTextFileUrls } from './permaweb-config.js';
import { Document } from 'flexsearch';

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

export class DocumentationSearchProvider extends SearchProvider {
    constructor() {
        super();
        this.docsData = [];
        this.docsIndex = null;
        this.docsUnavailable = false;
        this.contentCache = new Map(); // Cache for LLM text content
        this.initializationError = null; // Track initialization errors
        this.lastLoadAttempt = null; // Track when we last tried to load data
    }

    async initialize() {
        if (this.isInitialized) return true;
        
        console.log('Initializing documentation search provider...');
        
        try {
            // Load documentation data with improved error handling
            const loadSuccess = await this.loadDocumentationData();
            
            if (!loadSuccess) {
                this.initializationError = 'Failed to load documentation data';
                console.error('Documentation search initialization failed: No data loaded');
                return false;
            }
            
            // Create search index with validation
            const indexSuccess = this.createSearchIndex();
            
            if (!indexSuccess) {
                this.initializationError = 'Failed to create search index';
                console.error('Documentation search initialization failed: Index creation failed');
                return false;
            }
            
            console.log(`Documentation search index created successfully with ${this.docsData.length} pages.`);
            this.isInitialized = true;
            this.initializationError = null;
            return true;
            
        } catch (error) {
            this.initializationError = error.message;
            console.error('Failed to initialize documentation search provider:', error);
            this.docsUnavailable = true;
            return false;
        }
    }

    async search(query) {
        // Enhanced search with proper validation and error handling
        if (!this.isInitialized) {
            console.warn('Documentation search not initialized. Attempting to initialize...');
            const initSuccess = await this.initialize();
            if (!initSuccess) {
                return this._createErrorResult('Documentation search is not available. Please try again later.');
            }
        }

        if (this.docsUnavailable || !this.docsIndex) {
            console.warn('Documentation search is unavailable.');
            return this._createErrorResult('Documentation search is currently unavailable. Please try again later.');
        }

        if (!query || query.trim().length === 0) {
            return [];
        }

        try {
            const results = await this.docsIndex.search(query, {
                limit: 20,
                suggest: true,
                cache: true
            });
            
            const processedResults = this._processDocumentationResults(results, query);
            
            if (processedResults.length === 0) {
                return this._createNoResultsResult(query);
            }
            
            return processedResults;
            
        } catch (error) {
            console.error('Documentation search error:', error);
            return this._createErrorResult('An error occurred while searching. Please try again.');
        }
    }

    destroy() {
        this.docsData = [];
        this.docsIndex = null;
        this.docsUnavailable = false;
        this.contentCache.clear();
        this.initializationError = null;
        this.lastLoadAttempt = null;
        this.isInitialized = false;
    }

    async loadDocsIndex() {
        const indexUrls = getDocsIndexUrls();
        
        console.log('Loading docs index from:', indexUrls.primary);
        
        try {
            const response = await fetchWithTimeout(indexUrls.primary, {
                headers: { 'User-Agent': permawebConfig.network.userAgent }
            });
            
            if (!response.ok) {
                throw new Error(`Primary source failed: ${response.status} ${response.statusText}`);
            }
            
            const docsIndex = await response.json();
            console.log('Successfully loaded docs index from primary source');
            return docsIndex;
            
        } catch (primaryError) {
            console.warn('Primary docs index failed, trying fallback:', primaryError.message);
            
            try {
                const response = await fetchWithTimeout(indexUrls.fallback, {
                    headers: { 'User-Agent': permawebConfig.network.userAgent }
                });
                
                if (!response.ok) {
                    throw new Error(`Fallback source also failed: ${response.status} ${response.statusText}`);
                }
                
                const docsIndex = await response.json();
                console.log('Successfully loaded docs index from fallback source');
                return docsIndex;
                
            } catch (fallbackError) {
                throw new Error(`Both primary and fallback docs index sources failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
            }
        }
    }

    async loadPreExtractedContent() {
        try {
            const llmTextUrls = await getLLMTextFileUrls();
            const contentMap = new Map();
            let totalPages = 0;
            let successfulSites = 0;
            
            console.log('Loading pre-extracted content from LLM text files...');
            console.log('Available sites:', Object.keys(llmTextUrls));
            
            // Load content from each site's LLM text file
            for (const [siteKey, urls] of Object.entries(llmTextUrls)) {
                try {
                    console.log(`Loading content for site: ${siteKey}`);
                    
                    let response;
                    let content;
                    
                    try {
                        response = await fetchWithTimeout(urls.primary, {
                            headers: { 'User-Agent': permawebConfig.network.userAgent }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Primary source failed: ${response.status} ${response.statusText}`);
                        }
                        
                        content = await response.text();
                        console.log(`Successfully loaded ${siteKey} from primary source`);
                        
                    } catch (primaryError) {
                        console.warn(`Primary source failed for ${siteKey}, trying fallback:`, primaryError.message);
                        
                        response = await fetchWithTimeout(urls.fallback, {
                            headers: { 'User-Agent': permawebConfig.network.userAgent }
                        });
                        
                        if (!response.ok) {
                            throw new Error(`Fallback source also failed: ${response.status} ${response.statusText}`);
                        }
                        
                        content = await response.text();
                        console.log(`Successfully loaded ${siteKey} from fallback source`);
                    }
                    
                    // Parse the LLM text file content
                    const siteContentMap = this._parseLLMTextFile(content, siteKey);
                    const sitePageCount = siteContentMap.size;
                    
                    // Merge into main content map
                    siteContentMap.forEach((content, url) => {
                        contentMap.set(url, content);
                    });
                    
                    totalPages += sitePageCount;
                    successfulSites++;
                    
                    console.log(`Parsed ${sitePageCount} pages from ${siteKey}`);
                    
                } catch (error) {
                    // Continue with other sites if one fails
                    console.warn(`Failed to load content for ${siteKey}:`, error.message);
                }
            }
            
            console.log(`Successfully loaded ${totalPages} documentation pages from ${successfulSites} sites.`);
            
            if (contentMap.size === 0) {
                throw new Error('No content was successfully loaded from any site');
            }
            
            return contentMap;
            
        } catch (error) {
            console.error('Failed to load pre-extracted content:', error);
            return new Map();
        }
    }

    _parseLLMTextFile(text, siteKey) {
        const contentMap = new Map();
        
        if (!text || text.trim().length === 0) {
            console.warn(`Empty content received for site: ${siteKey}`);
            return contentMap;
        }
        
        // Parse the LLM text file format which contains documents separated by "---"
        const sections = text.split(/^---$/m);
        
        console.log(`Parsing ${sections.length} sections from ${siteKey}`);
        
        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            
            if (!section || section.trim().length === 0) {
                continue;
            }
            
            const lines = section.trim().split('\n');
            let url = '';
            let title = '';
            let content = '';
            let inContent = false;
            let metadataComplete = false;
            
            for (const line of lines) {
                if (line.startsWith('Source: ')) {
                    url = line.replace('Source: ', '').trim();
                } else if (line.startsWith('# ') && !url) {
                    // Title line (first # line before Source)
                    title = line.replace('# ', '').trim();
                } else if (line.startsWith('Document Number:') || 
                          line.startsWith('Words:') || 
                          line.startsWith('Quality Score:') ||
                          line.startsWith('Extraction Method:') ||
                          line.startsWith('Extraction Reason:')) {
                    // Skip metadata lines
                    continue;
                } else if (url && !inContent && line.trim() && !line.startsWith('#')) {
                    // Start content after metadata is complete and we have a URL
                    inContent = true;
                    content += line + '\n';
                } else if (inContent) {
                    content += line + '\n';
                }
            }
            
            if (url && content.trim()) {
                // Store both content and title
                contentMap.set(url, {
                    content: content.trim(),
                    title: title || this._extractTitleFromContent(content.trim()) || url
                });
            } else if (url && !content.trim()) {
                console.warn(`Section ${i} in ${siteKey} has URL but no content: ${url}`);
            }
        }
        
        console.log(`Successfully parsed ${contentMap.size} valid pages from ${siteKey}`);
        return contentMap;
    }

    _extractTitleFromContent(content) {
        if (!content) return '';
        
        // Try to find the first meaningful title in the content
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Look for markdown headers
            if (trimmedLine.startsWith('# ')) {
                return this._cleanTitle(trimmedLine.replace('# ', '').trim());
            }
            if (trimmedLine.startsWith('## ')) {
                return this._cleanTitle(trimmedLine.replace('## ', '').trim());
            }
            if (trimmedLine.startsWith('### ')) {
                return this._cleanTitle(trimmedLine.replace('### ', '').trim());
            }
            
            // Look for HTML title tags
            if (trimmedLine.includes('<title>') && trimmedLine.includes('</title>')) {
                const match = trimmedLine.match(/<title>(.*?)<\/title>/);
                if (match && match[1]) {
                    return this._cleanTitle(match[1].trim());
                }
            }
            
            // Look for the first non-empty line that's not a metadata line
            if (trimmedLine && 
                !trimmedLine.startsWith('Document Number:') &&
                !trimmedLine.startsWith('Words:') &&
                !trimmedLine.startsWith('Quality Score:') &&
                !trimmedLine.startsWith('Extraction Method:') &&
                !trimmedLine.startsWith('Extraction Reason:') &&
                !trimmedLine.startsWith('Source:') &&
                trimmedLine.length > 3) {
                return this._cleanTitle(trimmedLine);
            }
        }
        
        return '';
    }

    _cleanTitle(title) {
        if (!title) return '';
        
        // Remove numbers and common prefixes from the beginning of titles
        // Examples: "1. Introduction", "2. Getting Started", "3.1. Basic Concepts"
        let cleanedTitle = title;
        
        // Remove leading numbers with dots (e.g., "1.", "2.1.", "3.1.2.")
        cleanedTitle = cleanedTitle.replace(/^\d+(\.\d+)*\.?\s*/, '');
        
        // Remove common prefixes like "Chapter", "Section", "Part" with numbers
        cleanedTitle = cleanedTitle.replace(/^(Chapter|Section|Part|Chapter\s+\d+|Section\s+\d+|Part\s+\d+)\s*:?\s*/i, '');
        
        // Remove leading/trailing whitespace
        cleanedTitle = cleanedTitle.trim();
        
        // If we ended up with an empty string, return the original
        return cleanedTitle || title;
    }

    async _createDocumentationIndex() {
        if (this.docsData.length === 0) {
            console.error('Cannot create search index: No documentation data available');
            return false;
        }
        
        try {
            // Get FlexSearch Document class (handles dev/prod environments)
            this.docsIndex = new Document({
                document: {
                    id: "url",
                    index: [
                        { field: "title", tokenize: "forward", resolution: 9 },
                        { field: "content", tokenize: "forward", resolution: 5 },
                        { field: "fullContent", tokenize: "forward", resolution: 4 },
                        { field: "siteName", tokenize: "forward", resolution: 7 },
                        { field: "breadcrumbs", tokenize: "forward", resolution: 6 }
                    ],
                    store: true
                },
                preset: "score",
                tokenize: "forward",
                cache: 100,
                context: {
                    resolution: 3,
                    depth: 2,
                    bidirectional: true
                }
            });

            // Add each page to the index
            let addedCount = 0;
            for (const page of this.docsData) {
                try {
                    this.docsIndex.add(page);
                    addedCount++;
                } catch (error) {
                    console.warn(`Failed to add page to index: ${page.url}`, error.message);
                }
            }

            console.log(`Successfully added ${addedCount} pages to documentation search index.`);
            return addedCount > 0;
            
        } catch (error) {
            console.error('Failed to create documentation search index:', error);
            return false;
        }
    }

    _processDocumentationResults(results, query) {
        const resultMap = new Map();
        const queryLower = query.toLowerCase();
        
        if (!results || !Array.isArray(results)) {
            console.warn('Invalid search results received:', results);
            return [];
        }
        
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
        
        if (queryTerms.length === 0) return 0;
        
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
            if (page.title && page.title.toLowerCase().includes(termLower)) {
                score += fieldWeight * 10;
                if (page.title.toLowerCase() === termLower) {
                    score += fieldWeight * 20; // Exact title match
                }
            }
            
            // Content matches (medium weight)
            if (page.content && page.content.toLowerCase().includes(termLower)) {
                score += fieldWeight * 3;
            }
            
            // Full content matches (lower weight but important for comprehensive search)
            if (page.fullContent && page.fullContent.toLowerCase().includes(termLower)) {
                score += fieldWeight * 1;
                // Boost score if term appears multiple times in content
                const matches = (page.fullContent.toLowerCase().match(new RegExp(termLower, 'g')) || []).length;
                if (matches > 1) {
                    score += Math.min(matches * 0.5, 5); // Cap the boost
                }
            }
            
            // Site name matches
            if (page.siteName && page.siteName.toLowerCase().includes(termLower)) {
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
        if (page.content) {
            const snippetFromBasic = this._findBestSnippet(page.content, queryTerms);
            if (snippetFromBasic) {
                return snippetFromBasic;
            }
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

    async loadDocumentationData() {
        this.lastLoadAttempt = Date.now();
        
        try {
            console.log('Starting documentation data loading...');
            
            // First try to load pre-extracted content (fastest)
            const contentMap = await this.loadPreExtractedContent();
            
            if (contentMap.size > 0) {
                // Convert content map to docs data
                this.docsData = Array.from(contentMap.entries()).map(([url, data]) => {
                    // Handle both old format (string) and new format (object with content and title)
                    const content = typeof data === 'string' ? data : data.content;
                    const title = typeof data === 'string' ? this._extractTitleFromContent(data) : data.title;
                    
                    return new DocsPage({
                        url: url,
                        title: this._cleanTitle(title || url), // Clean the title and use extracted title or fallback to URL
                        content: content.substring(0, 500), // First 500 chars for basic content
                        fullContent: content,
                        siteName: 'Documentation',
                        estimatedWords: content.split(/\s+/).length,
                        breadcrumbs: []
                    });
                });
                console.log(`Successfully loaded ${this.docsData.length} documentation pages from pre-extracted content.`);
                return true;
            }
            
            console.log('Pre-extracted content not available, trying docs index...');
            
            // Fallback to loading docs index
            const docsIndex = await this.loadDocsIndex();
            
            if (!docsIndex || !Array.isArray(docsIndex) || docsIndex.length === 0) {
                throw new Error('Docs index is empty or invalid');
            }
            
            this.docsData = docsIndex;
            console.log(`Successfully loaded ${this.docsData.length} documentation pages from docs index.`);
            return true;
            
        } catch (error) {
            console.error('Failed to load documentation data:', error);
            this.docsUnavailable = true;
            this.initializationError = error.message;
            return false;
        }
    }

    createSearchIndex() {
        if (this.docsData.length === 0) {
            console.warn('No documentation data available to create search index.');
            return false;
        }
        
        return this._createDocumentationIndex();
    }

    // Helper methods for better error handling and user feedback
    _createErrorResult(message) {
        return [{
            url: '#error',
            title: 'Search Error',
            content: message,
            fullContent: message,
            siteName: 'System',
            score: 0,
            snippet: message,
            isError: true
        }];
    }

    _createNoResultsResult(query) {
        return [{
            url: '#no-results',
            title: 'No Results Found',
            content: `No documentation found for "${query}". Try different keywords or check your spelling.`,
            fullContent: `No documentation found for "${query}". Try different keywords or check your spelling.`,
            siteName: 'System',
            score: 0,
            snippet: `No documentation found for "${query}". Try different keywords or check your spelling.`,
            isNoResults: true
        }];
    }

    // Public method to get initialization status and error information
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isUnavailable: this.docsUnavailable,
            dataCount: this.docsData.length,
            hasIndex: !!this.docsIndex,
            lastLoadAttempt: this.lastLoadAttempt,
            error: this.initializationError
        };
    }
} 