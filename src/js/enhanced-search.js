// Enhanced Search System - Dual Mode (Glossary + Documentation)
// Integrates the advanced search from @permaweb-llms-fuel into permaweb-glossary

import { 
    initializeWayfinder, 
    getOptimalGatewayUrl, 
    routeGraphQLRequest, 
    getGatewayUrls,
    processDocsUrl,
    isWayfinderAvailable 
} from './wayfinder-utils.js';

// Search mode constants
const SEARCH_MODES = {
    GLOSSARY: 'glossary',
    DOCS: 'docs'
};

// Data source URLs
const GLOSSARY_URL = '../src/data/glossary.json';
const DOCS_INDEX_URL = 'https://dps.permaweb.tools/docs-index.json';
const DOCS_INDEX_FALLBACK = 'https://raw.githubusercontent.com/dpshade/permaweb-llm-fuel/main/public/docs-index.json';

// Application constants
const DEBUG = false;
const NUM_RANDOM_TAGS = 8;
const SEARCH_DEBOUNCE_MS = 200;
const MIN_SEARCH_LENGTH = 2;

// Interface definitions for documentation search
class DocsPage {
    constructor(data) {
        this.url = data.url;
        this.title = data.title;
        this.estimatedWords = data.estimatedWords;
        this.lastModified = data.lastModified;
        this.breadcrumbs = data.breadcrumbs;
        this.siteKey = data.siteKey;
        this.siteName = data.siteName;
        this.depth = data.depth;
        this.crawledAt = data.crawledAt;
        this.content = data.content;
    }
}

class SearchResult extends DocsPage {
    constructor(data, score, snippet) {
        super(data);
        this.score = score;
        this.snippet = snippet;
    }
}

// Enhanced Search Class
class EnhancedPermwebSearch {
    constructor() {
        this.currentMode = SEARCH_MODES.GLOSSARY;
        
        // Search indices
        this.glossaryIndex = null;
        this.docsIndex = null;
        
        // Data stores
        this.glossaryData = null;
        this.docsData = [];
        
        // UI state
        this.searchTimeout = null;
        this.activeIndex = 0;
        this.isNavigatingBetweenTerms = false;
        this.shuffledTerms = [];
        this.hideRecommendations = false;
        this.isKeyboardActive = false;
        this.prevQuery = '';
        this.isLoading = false;
        
        // DOM elements
        this.searchInput = document.getElementById('searchInput');
        this.resultsContainer = document.getElementById('results');
        this.loadingStatus = document.getElementById('loading-status');
        this.modeButtons = document.querySelectorAll('.mode-button');
        
        this.initializeApplication();
    }
    
    async initializeApplication() {
        // Initialize theme and URL parameters
        this.initializeTheme();
        this.applyQueryParameters();
        
        // Initialize mode toggle handlers
        this.initializeModeToggle();
        
        // Initialize search functionality
        this.initializeSearch();
        
        // Load data sources
        await this.loadGlossaryData();
        await this.loadDocsData();
        
        // Handle initial URL query
        this.handleInitialQuery();
        
        // Setup service worker
        this.registerServiceWorker();
    }
    
    initializeModeToggle() {
        this.modeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const newMode = e.currentTarget.dataset.mode;
                this.switchSearchMode(newMode);
            });
        });
    }
    
    switchSearchMode(mode) {
        if (mode === this.currentMode) return;
        
        // Update UI state
        this.modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // Update current mode
        this.currentMode = mode;
        
        // Update placeholder text
        const placeholder = mode === SEARCH_MODES.GLOSSARY 
            ? 'Search glossary terms...'
            : 'Search Permaweb documentation...';
        this.searchInput.placeholder = placeholder;
        
        // Clear current results and re-search if there's a query
        const currentQuery = this.searchInput.value.trim();
        if (currentQuery) {
            this.clearResults();
            this.performSearch(currentQuery);
        } else {
            this.clearResults();
            this.showRandomTerms();
        }
        
        if (DEBUG) console.log(`Switched to ${mode} mode`);
    }
    
    initializeSearch() {
        // Search input handler with debouncing
        this.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            this.handleSearchInput(query);
        });
        
        // Enter key handler
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.searchInput.value.trim()) {
                this.performSearch(this.searchInput.value.trim());
            }
        });
        
        // Focus search input on page load
        window.addEventListener('load', () => {
            this.searchInput.focus();
        });
    }
    
    handleSearchInput(query) {
        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        // Update URL
        this.updateURLWithSearch(query);
        
        if (query.length === 0) {
            this.clearResults();
            this.showRandomTerms();
            return;
        }
        
        if (query.length < MIN_SEARCH_LENGTH) {
            this.clearResults();
            this.hideRandomTerms();
            this.showStatus(`Type at least ${MIN_SEARCH_LENGTH} characters to search...`);
            return;
        }
        
        // Hide random terms when searching
        this.hideRandomTerms();
        
        // Debounce search
        this.searchTimeout = setTimeout(() => {
            this.performSearch(query);
        }, SEARCH_DEBOUNCE_MS);
    }
    
    async performSearch(query) {
        if (!query || query.length < MIN_SEARCH_LENGTH) return;
        
        this.showLoading();
        this.showStatus('Searching...');
        
        try {
            let results = [];
            
            if (this.currentMode === SEARCH_MODES.GLOSSARY) {
                results = await this.searchGlossary(query);
            } else {
                results = await this.searchDocumentation(query);
            }
            
            if (results.length === 0) {
                this.showNoResults(query);
            } else {
                this.displayResults(results, query);
                this.showStatus(`Found ${results.length} result${results.length === 1 ? '' : 's'} for "${query}"`);
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showError();
            this.showStatus('Search failed. Please try again.');
        }
    }
    
    async searchGlossary(query) {
        if (!this.glossaryIndex || !this.glossaryData) {
            throw new Error('Glossary data not loaded');
        }
        
        // Use the existing glossary search logic
        const results = this.glossaryIndex.search(query, { suggest: true });
        return this.processGlossaryResults(results, query);
    }
    
    async searchDocumentation(query) {
        if (!this.docsIndex || this.docsData.length === 0) {
            throw new Error('Documentation data not loaded');
        }
        
        // Perform search with multiple strategies
        const results = await this.docsIndex.search(query, {
            limit: 20,
            suggest: true
        });
        
        return this.processDocumentationResults(results, query);
    }
    
    processDocumentationResults(results, query) {
        const resultMap = new Map();
        const queryLower = query.toLowerCase();
        
        // Process FlexSearch results
        results.forEach(resultSet => {
            if (resultSet && resultSet.result && Array.isArray(resultSet.result)) {
                resultSet.result.forEach((url) => {
                    const page = this.docsData.find(p => p.url === url);
                    if (page && !resultMap.has(url)) {
                        const score = this.calculateRelevanceScore(page, queryLower, resultSet.field);
                        const snippet = this.generateSnippet(page, queryLower);
                        
                        resultMap.set(url, new SearchResult(page, score, snippet));
                    }
                });
            }
        });
        
        // Sort by relevance score and limit results
        return Array.from(resultMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }
    
    calculateRelevanceScore(page, query, field) {
        let score = 0;
        const titleLower = page.title.toLowerCase();
        const contentLower = page.content?.toLowerCase() || '';
        const siteNameLower = page.siteName.toLowerCase();
        
        // Base score based on which field matched
        if (field === 'title') score += 100;
        else if (field === 'siteName') score += 75;
        else if (field === 'content') score += 50;
        
        // Exact title match gets highest score
        if (titleLower === query) score += 100;
        else if (titleLower.includes(query)) score += 50;
        
        // Title word matches
        const queryWords = query.split(/\s+/);
        queryWords.forEach(word => {
            if (titleLower.includes(word)) score += 20;
            if (contentLower.includes(word)) score += 5;
            if (siteNameLower.includes(word)) score += 10;
        });
        
        // Boost popular sites (shallower pages are likely more important)
        if (page.depth !== undefined && page.depth <= 2) score += 10;
        
        // Boost recently updated content
        if (page.lastModified) {
            const daysSinceUpdate = (Date.now() - new Date(page.lastModified).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceUpdate < 30) score += 5;
        }
        
        return score;
    }
    
    generateSnippet(page, query) {
        const parts = [];
        
        // Add breadcrumb context if available
        if (page.breadcrumbs && page.breadcrumbs.length > 0) {
            const meaningfulCrumbs = page.breadcrumbs
                .filter(crumb => {
                    const cleaned = crumb.replace(/\.(html?|php|aspx?)$/i, '').toLowerCase();
                    return cleaned !== 'index' && cleaned !== 'main' && cleaned !== 'home' && cleaned.length > 1;
                })
                .slice(0, 3);
            
            if (meaningfulCrumbs.length > 0) {
                parts.push(`Part of: ${meaningfulCrumbs.join(' → ')}`);
            }
        }
        
        // Add site context
        parts.push(`${page.siteName} documentation`);
        
        // Add estimated reading time if available
        if (page.estimatedWords) {
            const readTime = Math.ceil(page.estimatedWords / 200);
            parts.push(`~${readTime} min read`);
        }
        
        return parts.join(' • ');
    }
    
    // ... (Additional methods for data loading, result display, etc. will be added)
    
    showLoading() {
        this.hideAllStates();
        this.loadingStatus.style.display = 'block';
    }
    
    showNoResults(query) {
        this.hideAllStates();
        this.resultsContainer.innerHTML = `
            <div class="no-results">
                <p>No results found for "${query}"</p>
                <p>Try adjusting your search terms or check for typos.</p>
            </div>
        `;
        this.resultsContainer.style.display = 'block';
    }
    
    showError() {
        this.hideAllStates();
        this.resultsContainer.innerHTML = `
            <div class="error-state">
                <p>Search unavailable</p>
                <p>Unable to load search index. Please try again later.</p>
            </div>
        `;
        this.resultsContainer.style.display = 'block';
    }
    
    hideAllStates() {
        this.loadingStatus.style.display = 'none';
        this.resultsContainer.style.display = 'none';
    }
    
    clearResults() {
        this.resultsContainer.innerHTML = '';
        this.resultsContainer.style.display = 'none';
    }
    
    showStatus(message) {
        // Update status display (you can add a status element if needed)
        if (DEBUG) console.log('Status:', message);
    }
    
    showRandomTerms() {
        // Show random terms for glossary mode
        if (this.currentMode === SEARCH_MODES.GLOSSARY && this.glossaryData && !this.hideRecommendations) {
            this.generateRandomTermTags();
        }
    }
    
    generateRandomTermTags() {
        // Check if glossary data is available
        if (!Array.isArray(this.glossaryData) || this.glossaryData.length === 0) {
            console.warn('Cannot generate random terms: glossary data not available');
            return;
        }
        
        // Check if we already have shuffled terms or need to create them
        if (this.shuffledTerms.length === 0) {
            this.shuffledTerms = [...this.glossaryData].sort(() => Math.random() - 0.5);
        }
        
        // Create container for random terms if it doesn't exist
        let randomTermsContainer = document.getElementById('random-terms');
        if (!randomTermsContainer) {
            randomTermsContainer = document.createElement('div');
            randomTermsContainer.id = 'random-terms';
            randomTermsContainer.className = 'random-terms-container';
            
            // Insert after the search input
            const searchContainer = document.querySelector('.search-input');
            if (searchContainer && searchContainer.parentNode) {
                searchContainer.parentNode.insertBefore(randomTermsContainer, searchContainer.nextSibling);
            }
        }
        
        // Generate random term tags
        const termTags = this.shuffledTerms
            .slice(0, NUM_RANDOM_TAGS)
            .map(term => {
                return `<span class="random-term-tag" data-term="${term.term}">${term.term}</span>`;
            })
            .join('');
        
        randomTermsContainer.innerHTML = `
            <div class="random-terms-header">Explore terms:</div>
            <div class="random-terms-list">${termTags}</div>
        `;
        
        // Add click handlers for random terms
        randomTermsContainer.querySelectorAll('.random-term-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                const term = tag.getAttribute('data-term');
                this.searchInput.value = term;
                this.performSearch(term);
            });
        });
        
        randomTermsContainer.style.display = 'block';
    }
    
    hideRandomTerms() {
        const randomTermsContainer = document.getElementById('random-terms');
        if (randomTermsContainer) {
            randomTermsContainer.style.display = 'none';
        }
    }
    
    updateURLWithSearch(query) {
        if (!query) {
            const newUrl = window.location.pathname;
            window.history.pushState({}, '', newUrl);
            document.title = 'Permaweb Glossary';
        } else {
            const newUrl = `${window.location.pathname}?q=${encodeURIComponent(query)}`;
            window.history.pushState({}, '', newUrl);
            document.title = `${query} - Permaweb Glossary`;
        }
    }
    
    handleInitialQuery() {
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        if (query) {
            this.searchInput.value = query;
            this.performSearch(query);
        } else {
            this.showRandomTerms();
        }
    }
    
    async loadGlossaryData() {
        try {
            const response = await fetch(GLOSSARY_URL);
            if (!response.ok) {
                throw new Error(`Failed to load glossary: ${response.status}`);
            }
            
            const data = await response.json();
            // Handle both array format and object with terms property
            this.glossaryData = data.terms || data;
            
            // Validate that we have an array
            if (!Array.isArray(this.glossaryData)) {
                throw new Error('Glossary data is not in the expected array format');
            }
            
            this.createGlossaryIndex();
            
            if (DEBUG) console.log(`Loaded ${this.glossaryData.length} glossary terms`);
        } catch (error) {
            console.error('Failed to load glossary data:', error);
            throw error;
        }
    }
    
    async loadDocsData() {
        try {
            let response;
            let docsIndex;
            
            // Try primary source first, then fallback
            try {
                response = await fetch(DOCS_INDEX_URL);
                if (!response.ok) {
                    throw new Error(`Primary source failed: ${response.status}`);
                }
                docsIndex = await response.json();
            } catch (primaryError) {
                console.warn('Primary docs index failed, trying fallback...', primaryError);
                
                response = await fetch(DOCS_INDEX_FALLBACK);
                if (!response.ok) {
                    throw new Error(`Fallback source also failed: ${response.status}`);
                }
                docsIndex = await response.json();
            }
            
            this.processDocumentationData(docsIndex);
            this.createDocumentationIndex();
            
            const siteCount = Object.keys(docsIndex.sites || {}).length;
            if (DEBUG) console.log(`Loaded ${this.docsData.length} documentation pages from ${siteCount} sites`);
        } catch (error) {
            console.error('Failed to load documentation data:', error);
            // Don't throw - documentation search is optional
        }
    }
    
    createGlossaryIndex() {
        if (!Array.isArray(this.glossaryData) || this.glossaryData.length === 0) {
            console.error('Cannot create glossary index: no valid data available');
            return;
        }
        
        this.glossaryIndex = new FlexSearch.Document({
            tokenize: 'forward',
            cache: true,
            resolution: 9,
            context: {
                depth: 2,
                resolution: 3
            },
            document: {
                id: 'term',
                index: [
                    {
                        field: 'term',
                        tokenize: 'forward',
                        optimize: true,
                        resolution: 9
                    },
                    {
                        field: 'definition',
                        tokenize: 'forward',
                        optimize: true,
                        resolution: 5
                    },
                    {
                        field: 'aliases',
                        tokenize: 'forward',
                        optimize: true,
                        resolution: 7
                    },
                    {
                        field: 'category',
                        tokenize: 'forward',
                        optimize: true,
                        resolution: 6
                    }
                ]
            }
        });
        
        // Add all glossary terms to the index with error handling
        this.glossaryData.forEach(term => {
            try {
                this.glossaryIndex.add(term);
            } catch (error) {
                console.warn('Failed to add term to index:', term, error);
            }
        });
    }
    
    createDocumentationIndex() {
        this.docsIndex = new FlexSearch.Document({
            tokenize: 'forward',
            cache: true,
            resolution: 9,
            context: {
                depth: 2,
                resolution: 3
            },
            document: {
                id: 'url',
                index: [
                    {
                        field: 'title',
                        tokenize: 'forward',
                        optimize: true,
                        resolution: 9
                    },
                    {
                        field: 'content', 
                        tokenize: 'forward',
                        optimize: true,
                        resolution: 5
                    },
                    {
                        field: 'siteName',
                        tokenize: 'forward',
                        optimize: true,
                        resolution: 7
                    }
                ]
            }
        });
        
        // Add all documents to the index
        this.docsData.forEach(page => {
            this.docsIndex.add(page);
        });
    }
    
    processDocumentationData(docsIndex) {
        this.docsData = [];
        
        const sites = docsIndex.sites || {};
        
        for (const [siteKey, siteData] of Object.entries(sites)) {
            // Skip metadata entries
            if (siteKey === "_metadata" || siteKey === "generated") continue;
            
            const site = siteData;
            
            if (site.pages && Array.isArray(site.pages)) {
                for (const page of site.pages) {
                    // Calculate estimated words if not provided
                    const estimatedWords = page.estimatedWords || Math.max(300, page.title.length * 15);
                    
                    // Create searchable content from page data
                    const searchableContent = [
                        page.title,
                        page.breadcrumbs?.join(' ') || '',
                        site.name,
                        page.url.split('/').pop()?.replace(/\.(html|md)$/, '') || ''
                    ].filter(Boolean).join(' ');
                    
                    this.docsData.push(new DocsPage({
                        ...page,
                        siteKey,
                        siteName: site.name,
                        estimatedWords,
                        content: searchableContent
                    }));
                }
            }
        }
    }
    
    processGlossaryResults(results, query) {
        const processedResults = [];
        const queryLower = query.toLowerCase();
        
        // Process FlexSearch results for glossary
        if (Array.isArray(results)) {
            results.forEach(resultSet => {
                if (resultSet && resultSet.result && Array.isArray(resultSet.result)) {
                    resultSet.result.forEach((termId) => {
                        const term = this.glossaryData.find(t => t.term === termId);
                        if (term && !processedResults.find(r => r.term === term.term)) {
                            processedResults.push({
                                ...term,
                                score: this.calculateGlossaryRelevanceScore(term, queryLower, resultSet.field)
                            });
                        }
                    });
                }
            });
        }
        
        return processedResults
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }
    
    calculateGlossaryRelevanceScore(term, query, field) {
        let score = 0;
        const termLower = term.term.toLowerCase();
        const definitionLower = term.definition.toLowerCase();
        const aliasesLower = (term.aliases || []).join(' ').toLowerCase();
        
        // Base score based on which field matched
        if (field === 'term') score += 100;
        else if (field === 'aliases') score += 80;
        else if (field === 'definition') score += 50;
        else if (field === 'category') score += 30;
        
        // Exact matches
        if (termLower === query) score += 200;
        else if (termLower.includes(query)) score += 100;
        
        // Alias matches
        if (aliasesLower.includes(query)) score += 75;
        
        // Word matches
        const queryWords = query.split(/\s+/);
        queryWords.forEach(word => {
            if (termLower.includes(word)) score += 25;
            if (definitionLower.includes(word)) score += 10;
            if (aliasesLower.includes(word)) score += 20;
        });
        
        return score;
    }
    
    displayResults(results, query) {
        this.hideAllStates();
        this.resultsContainer.style.display = 'block';
        
        if (this.currentMode === SEARCH_MODES.GLOSSARY) {
            this.displayGlossaryResults(results, query);
        } else {
            this.displayDocumentationResults(results, query);
        }
        
        // Notify keyboard navigation that results are displayed
        if (window.enhancedKeyboardNav) {
            window.enhancedKeyboardNav.onResultsDisplayed();
        }
    }
    
    displayGlossaryResults(results, query) {
        this.resultsContainer.innerHTML = results.map(result => 
            this.createGlossaryResultHTML(result, query)
        ).join('');
        
        // Add click handlers and setup interactions
        this.setupGlossaryResultHandlers();
    }
    
    displayDocumentationResults(results, query) {
        this.resultsContainer.innerHTML = results.map(result => 
            this.createDocumentationResultHTML(result, query)
        ).join('');
        
        // Add click handlers
        this.setupDocumentationResultHandlers();
    }
    
    createGlossaryResultHTML(result, query) {
        const termDisplay = this.highlightQuery(result.term, query);
        const definitionDisplay = this.highlightQuery(result.definition, query);
        const aliasesDisplay = result.aliases && result.aliases.length > 0 
            ? `<div class="term-aliases">Also known as: ${result.aliases.map(alias => this.highlightQuery(alias, query)).join(', ')}</div>`
            : '';
        
        return `
            <div class="result-item glossary-result" data-term="${result.term}" tabindex="0" role="button">
                <div class="term-header">
                    <h3 class="term-name">${termDisplay}</h3>
                    ${result.category ? `<span class="term-category">${result.category}</span>` : ''}
                </div>
                <div class="term-definition">${definitionDisplay}</div>
                ${aliasesDisplay}
                ${result.relatedTerms && result.relatedTerms.length > 0 ? `
                    <div class="related-terms">
                        Related: ${result.relatedTerms.map(term => `<span class="related-term" data-term="${term}">${term}</span>`).join(', ')}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    createDocumentationResultHTML(result, query) {
        const breadcrumbs = result.breadcrumbs?.join(' › ') || result.siteName;
        const lastModified = result.lastModified 
            ? new Date(result.lastModified).toLocaleDateString()
            : '';
        
        const estimatedReadTime = result.estimatedWords 
            ? `${Math.ceil(result.estimatedWords / 200)} min read`
            : '';
        
        return `
            <div class="result-item docs-result" data-url="${result.url}" tabindex="0" role="button" aria-label="Open ${result.title}">
                <div class="result-breadcrumbs">${breadcrumbs}</div>
                <h3 class="result-title">${this.highlightQuery(result.title, query)}</h3>
                <p class="result-snippet">${this.highlightQuery(result.snippet, query)}</p>
                <div class="result-meta">
                    ${estimatedReadTime ? `<span>${estimatedReadTime}</span>` : ''}
                    ${lastModified ? `<span>Updated ${lastModified}</span>` : ''}
                    <span>${new URL(result.url).hostname}</span>
                </div>
            </div>
        `;
    }
    
    highlightQuery(text, query) {
        if (!query.trim()) return text;
        
        const words = query.trim().split(/\s+/);
        let highlightedText = text;
        
        words.forEach(word => {
            const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            highlightedText = highlightedText.replace(regex, '<span class="highlight">$1</span>');
        });
        
        return highlightedText;
    }
    
    setupGlossaryResultHandlers() {
        this.resultsContainer.querySelectorAll('.glossary-result').forEach(item => {
            item.addEventListener('click', () => {
                const term = item.getAttribute('data-term');
                if (term) {
                    // Handle glossary term click (existing functionality)
                    this.handleGlossaryTermClick(term);
                }
            });
            
            // Keyboard navigation
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    item.click();
                }
            });
        });
        
        // Setup related term handlers
        this.resultsContainer.querySelectorAll('.related-term').forEach(relatedTerm => {
            relatedTerm.addEventListener('click', (e) => {
                e.stopPropagation();
                const term = relatedTerm.getAttribute('data-term');
                this.searchInput.value = term;
                this.performSearch(term);
            });
        });
    }
    
    setupDocumentationResultHandlers() {
        this.resultsContainer.querySelectorAll('.docs-result').forEach(item => {
            item.addEventListener('click', () => {
                const url = item.getAttribute('data-url');
                if (url) {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            });
            
            // Keyboard navigation
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const url = item.getAttribute('data-url');
                    if (url) {
                        window.open(url, '_blank', 'noopener,noreferrer');
                    }
                }
            });
        });
    }
    
    handleGlossaryTermClick(term) {
        // Existing glossary functionality for term display
        console.log(`Clicked glossary term: ${term}`);
    }
    
    initializeTheme() {
        // Initialize theme switching (keeping existing functionality)
        const themeToggle = document.querySelector('.theme-toggle');
        const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
        
        // Load saved theme or default to user's preference
        const savedTheme = localStorage.getItem('theme');
        const currentTheme = savedTheme || (prefersDarkScheme.matches ? 'dark' : 'light');
        
        document.documentElement.setAttribute('data-theme', currentTheme);
        
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
            });
        }
    }
    
    applyQueryParameters() {
        // Apply URL query parameters (keeping existing functionality)
        const urlParams = new URLSearchParams(window.location.search);
        
        // Handle hide-header parameter
        const hideHeader = urlParams.get('hide-header');
        if (hideHeader === 'true' || hideHeader === '1') {
            document.documentElement.classList.add('hide-header');
            window.randomTermsJustification = 'center';
        } else {
            window.randomTermsJustification = 'flex-start';
        }
        
        // Handle hide-recommendations parameter
        const hideRecommendationsParam = urlParams.get('hide-recommendations');
        if (hideRecommendationsParam === 'true' || hideRecommendationsParam === '1') {
            this.hideRecommendations = true;
            document.documentElement.classList.add('hide-recommendations');
        }
        
        // Handle iframe embed detection
        if (window.self !== window.top) {
            document.documentElement.classList.add('iframe-embed');
        }
    }
    
    registerServiceWorker() {
        // Register service worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(registration => {
                        if (DEBUG) console.log('ServiceWorker registration successful');
                    })
                    .catch(err => {
                        if (DEBUG) console.log('ServiceWorker registration failed:', err);
                    });
            });
        }
    }
}

// Initialize the enhanced search when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EnhancedPermwebSearch();
});

export default EnhancedPermwebSearch;