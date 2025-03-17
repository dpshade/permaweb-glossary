// Constants for the application
const GLOSSARY_URL = '../src/data/glossary.json';
const ARWEAVE_GRAPHQL_URL = 'https://arweave-search.goldsky.com/graphql';
const DEBUG = false; // Debug flag for logging
const NUM_RANDOM_TAGS = 8; // Number of random term tags to display

// State variables
let searchIndex = null;
let glossaryData = null;
let searchTimeout = null;
let activeIndex = 0;
let isNavigatingBetweenTerms = false; // Flag to track term navigation
let shuffledTerms = []; // Global variable to store shuffled terms
let hideRecommendations = false; // Flag to track if recommendations should be hidden
let isKeyboardActive = false; // Flag to track if the keyboard is active

// DOM elements
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('results');
const loadingStatus = document.getElementById('loading-status');

// Theme switching functionality
const themeToggle = document.querySelector('.theme-toggle');
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

// URL parameter handling
function getSearchQueryFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('q');
}

function updateURLWithSearch(query) {
    if (!query) {
        // If no query, remove the search parameter
        const newUrl = window.location.pathname;
        window.history.pushState({}, '', newUrl);
    } else {
        // Update URL with search query, maintaining the current path
        const newUrl = `${window.location.pathname}?q=${encodeURIComponent(query)}`;
        window.history.pushState({}, '', newUrl);
    }
}

// Helper functions
function isIframeEmbed() {
    return window.self !== window.top;
}

// Function to apply query parameters for visual customization
function applyQueryParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    if (DEBUG) console.log('URL search params:', window.location.search);
    
    // ===== UI VISIBILITY PARAMETERS =====
    // Handle hide-header parameter
    const hideHeader = urlParams.get('hide-header');
    if (hideHeader === 'true' || hideHeader === '1') {
        document.documentElement.classList.add('hide-header');
        // Store justification preference in a global variable that can be used later
        window.randomTermsJustification = 'center';
        if (DEBUG) console.log('Header hidden based on URL parameter');
    } else {
        // When header is not hidden, we'll use flex-start for iframe embed
        window.randomTermsJustification = 'flex-start';
    }
    
    // Handle hide-recommendations parameter
    const hideRecommendationsParam = urlParams.get('hide-recommendations');
    if (hideRecommendationsParam === 'true' || hideRecommendationsParam === '1') {
        hideRecommendations = true;
        document.documentElement.classList.add('hide-recommendations');
        if (DEBUG) console.log('Recommendations hidden based on URL parameter');
    }
    
    // Handle translucent background parameter
    const translucent = urlParams.get('translucent');
    if (translucent) {
        document.documentElement.classList.add('translucent-bg');
        
        // Apply custom opacity if numeric value is provided
        const opacity = parseFloat(translucent);
        if (!isNaN(opacity) && opacity >= 0 && opacity <= 1) {
            document.documentElement.style.setProperty('--translucent-opacity', opacity);
            if (DEBUG) console.log(`Translucent background applied with opacity: ${opacity}`);
        }
    }
    
    // ===== COLOR PARAMETERS =====
    const colorParams = {
        '--ao-bg-color': urlParams.get('bg-color'),
        '--ao-text-color': urlParams.get('text-color'),
        '--ao-border-color': urlParams.get('border-color'),
        '--ao-input-bg': urlParams.get('input-bg') || urlParams.get('bg-color'),
        '--ao-hover-bg': urlParams.get('hover-bg'),
        '--ao-category-bg': urlParams.get('category-bg'),
        '--ao-category-text': urlParams.get('category-text'),
        '--ao-link-color': urlParams.get('link-color'),
        '--ao-result-bg': urlParams.get('result-bg') || urlParams.get('bg-color'),
        '--ao-result-hover': urlParams.get('result-hover') || urlParams.get('hover-bg'),
        '--ao-heading-color': urlParams.get('heading-color') || urlParams.get('text-color'),
        '--ao-tag-bg': urlParams.get('tag-bg') || urlParams.get('border-color'),
        '--ao-tag-text': urlParams.get('tag-text') || urlParams.get('bg-color'),
        '--ao-button-bg': urlParams.get('button-bg') || urlParams.get('border-color'),
        '--ao-button-text': urlParams.get('button-text') || urlParams.get('bg-color'),
        '--ao-accent-color': urlParams.get('accent-color') || urlParams.get('link-color'),
        '--ao-secondary-text': urlParams.get('secondary-text') || urlParams.get('category-text')
    };
    
    // Apply any colors that were provided as URL parameters
    const root = document.documentElement;
    let colorsApplied = false;
    let appliedColors = {};
    
    Object.entries(colorParams).forEach(([varName, value]) => {
        if (value) {
            // Validate that the value is a valid hex color
            if (/^#([0-9A-F]{3}){1,2}$/i.test(value)) {
                root.style.setProperty(varName, value);
                colorsApplied = true;
                appliedColors[varName] = value;
                
                // Special handling for bg-color when translucent is enabled
                if (varName === '--ao-bg-color' && translucent) {
                    // Convert hex to rgba for translucent background
                    let r, g, b;
                    
                    // Handle both 3-digit and 6-digit hex colors
                    if (value.length === 4) {
                        r = parseInt(value[1] + value[1], 16);
                        g = parseInt(value[2] + value[2], 16);
                        b = parseInt(value[3] + value[3], 16);
                    } else {
                        r = parseInt(value.slice(1, 3), 16);
                        g = parseInt(value.slice(3, 5), 16);
                        b = parseInt(value.slice(5, 7), 16);
                    }
                    
                    const a = root.style.getPropertyValue('--translucent-opacity') || 0.92;
                    root.style.setProperty('--translucent-bg-color', `rgba(${r}, ${g}, ${b}, ${a})`);
                    if (DEBUG) console.log(`Custom background color applied for translucent mode: ${value} with opacity ${a}`);
                }
            } else {
                if (DEBUG) console.warn(`Invalid color value for ${varName}:`, value);
            }
        }
    });
    
    if (DEBUG) {
        if (colorsApplied) {
            console.log('Successfully applied colors:', appliedColors);
        } else {
            console.log('No valid colors found in URL parameters');
        }
    }
}

// Initialize the application
async function init() {
    try {
        updateLoadingStatus('Loading glossary data...');
        
        // Apply all query parameters in one call
        applyQueryParameters();
        
        // Apply iframe-specific behavior
        if (isIframeEmbed()) {
            document.documentElement.classList.add('iframe-embed');
            if (DEBUG) console.log('Added iframe-embed class via script');
            
            // Listen for messages from parent page for resize events only
            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'resize') {
                    if (DEBUG) console.log('Received resize event:', event.data);
                }
            });
        }
        
        // Load glossary data
        const response = await fetch(GLOSSARY_URL);
        if (!response.ok) {
            throw new Error('Failed to load glossary data');
        }
        
        // Parse the glossary data
        const data = await response.json();
        glossaryData = data.terms || data; // Handle both formats
        
        // Initialize FlexSearch index with simpler configuration to avoid errors
        searchIndex = new FlexSearch.Document({
            document: {
                id: "id",
                index: ["term", "definition", "aliases", "category"],
                store: true
            },
            tokenize: "forward",
            cache: 100
        });
        
        // Create a context map for better semantic-like matching
        const contextMap = buildContextMap(glossaryData);
        
        // Add glossary data to the index with unique IDs
        glossaryData.forEach((item, index) => {
            // Create a searchable text that includes aliases
            const searchableText = item.aliases && item.aliases.length > 0 
                ? item.aliases.join(' ') 
                : '';
                
            // Get related terms and context for this item
            const relatedTerms = item.related || [];
            const context = contextMap[item.term.toLowerCase()] || '';
                
            searchIndex.add({
                id: index.toString(),
                term: item.term,
                definition: item.definition + ' ' + context, // Add context to definition for better matching
                category: item.category,
                aliases: searchableText,
                related: relatedTerms
            });
        });
        
        // Hide loading status and enable search
        updateLoadingStatus('');
        
        // Add event listener for search input
        searchInput.addEventListener('input', handleSearch);
        
        // Initialize keyboard navigation
        if (window.keyboardNav) {
            window.keyboardNav.init();
        }
        
        // Check for initial search query in URL
        const initialQuery = getSearchQueryFromURL();
        if (initialQuery) {
            searchInput.value = initialQuery;
            // Update title with the search term
            document.title = `${initialQuery} - Permaweb Glossary`;
            // Set keyboard active flag to ensure first result is selected
            isKeyboardActive = true;
            document.body.classList.add('keyboard-active');
            // Perform the search
            performSearch(initialQuery);
        }
        
        // Add unified keyboard navigation for iframe mode
        if (isIframeEmbed()) {
            document.addEventListener('keydown', (e) => {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    e.preventDefault();
                    const direction = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
                    navigateResults(direction);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    // Get the currently active result
                    const activeResult = document.querySelector('.result-display.active');
                    if (activeResult) {
                        // Find the documentation link in the active result
                        const docLink = activeResult.querySelector('.docs-link a');
                        if (docLink) {
                            // Navigate to the documentation link
                            window.open(docLink.href, '_blank', 'noopener,noreferrer');
                        }
                    }
                }
            });
        }
        
        // Create and display random term tags unless explicitly hidden
        if (!hideRecommendations) {
            createRandomTermTags();
        }
        
        searchInput.focus();
        
        console.log('Search index initialized successfully');
    } catch (error) {
        console.error('Initialization error:', error);
        updateLoadingStatus(`Error: ${error.message}. Please refresh the page to try again.`, true);
    }
}

// Build a context map for better semantic-like matching
function buildContextMap(glossaryItems) {
    const contextMap = {};
    
    // First pass: collect all terms and their definitions
    glossaryItems.forEach(item => {
        contextMap[item.term.toLowerCase()] = item.definition;
    });
    
    // Second pass: for each term, find other terms that might be related
    // based on term occurrence in definitions
    glossaryItems.forEach(item => {
        const termLower = item.term.toLowerCase();
        const relatedContext = [];
        
        // Look for this term in other definitions
        glossaryItems.forEach(otherItem => {
            const otherTermLower = otherItem.term.toLowerCase();
            
            // Skip self-comparison
            if (termLower === otherTermLower) return;
            
            // If this term appears in another definition, consider it related
            if (otherItem.definition.toLowerCase().includes(termLower)) {
                relatedContext.push(otherItem.term);
            }
            
            // Check if the other term appears in this definition
            if (item.definition.toLowerCase().includes(otherTermLower)) {
                relatedContext.push(otherItem.term);
            }
        });
        
        // Add the related context to the map
        if (relatedContext.length > 0) {
            contextMap[termLower] += ' ' + relatedContext.join(' ');
        }
    });
    
    return contextMap;
}

// Update the loading status message
function updateLoadingStatus(message, isError = false) {
    if (!loadingStatus) return;
    
    // Handle case where loadingStatus has multiple child elements
    if (loadingStatus.querySelector('p')) {
        loadingStatus.querySelector('p').textContent = message || 'Ready to search';
    } else {
        loadingStatus.textContent = message || 'Ready to search';
    }
    
    loadingStatus.style.display = message ? 'block' : 'none';
    
    if (isError) {
        loadingStatus.classList.add('error');
    } else {
        loadingStatus.classList.remove('error');
    }
}

// Clean search query by removing punctuation at the end and extra whitespace
function cleanSearchQuery(query) {
    return query
        .replace(/[.,\/#!$%\^&\*;:{}=_`~()'"]+$/, '') // Remove punctuation only at the end
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim(); // Remove leading/trailing whitespace
}

// Handle search input with debounce
function handleSearch(event) {
    const query = cleanSearchQuery(event.target.value);
    
    // Update URL with search query
    updateURLWithSearch(query);
    
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // Clear results if query is empty
    if (!query) {
        resultsContainer.innerHTML = '';
        // Only remove classes if we're not navigating between terms
        if (!isNavigatingBetweenTerms) {
            resultsContainer.classList.remove('has-results');
            document.querySelector('.search-container').classList.remove('has-results');
        }
        
        // Refresh random term tags when search is cleared (unless recommendations are hidden)
        if (!hideRecommendations) {
            reshuffleTermTags();
        }
        
        return;
    }
    
    // Debounce search to avoid too many requests
    searchTimeout = setTimeout(() => {
        // Check if input is an Arweave transaction ID (43 characters, no spaces)
        if (query.length === 43 && !query.includes(' ')) {
            fetchArweaveTx(query);
        } else {
            performSearch(query);
        }
        
        // Refresh random term tags after search (unless recommendations are hidden)
        if (!hideRecommendations) {
            reshuffleTermTags();
        }
    }, 150); // Even faster response time
}

// Fetch Arweave transaction data
async function fetchArweaveTx(txId) {
    try {
        resultsContainer.innerHTML = '<div class="loading-tx">Fetching transaction data...</div>';
        resultsContainer.classList.add('has-results');
        document.querySelector('.search-container').classList.add('has-results');
        
        const query = `{
            transactions(ids: ["${txId}"]) {
                edges {
                    node {
                        id
                        tags {
                            name
                            value
                        }
                        owner {
                            address
                        }
                        block {
                            height
                            timestamp
                        }
                        data {
                            size
                            type
                        }
                    }
                }
            }
        }`;
        
        const response = await fetch(ARWEAVE_GRAPHQL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        
        if (!response.ok) {
            throw new Error(`Network error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.errors) {
            throw new Error(result.errors[0].message);
        }
        
        displayTxResults(result.data);
    } catch (error) {
        console.error('Transaction fetch error:', error);
        resultsContainer.innerHTML = `<div class="error-message">Error fetching transaction: ${error.message}</div>`;
    }
}

// Display transaction results
function displayTxResults(data) {
    resultsContainer.innerHTML = '';
    
    if (!data || !data.transactions || data.transactions.edges.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">Transaction not found</div>';
        resultsContainer.classList.add('has-results');
        document.querySelector('.search-container').classList.add('has-results');
        return;
    }
    
    const txNode = data.transactions.edges[0].node;
    
    // Format timestamp if available
    let timestamp = 'Pending';
    if (txNode.block && txNode.block.timestamp) {
        const date = new Date(txNode.block.timestamp * 1000);
        timestamp = date.toLocaleString();
    }
    
    // Format data size
    const dataSize = formatBytes(txNode.data.size);
    
    // Extract Content-Type tag if available
    let contentType = 'Unknown';
    if (txNode.tags && txNode.tags.length > 0) {
        const contentTypeTag = txNode.tags.find(tag => tag.name.toLowerCase() === 'content-type');
        if (contentTypeTag) {
            contentType = contentTypeTag.value;
        }
    }
    
    // Create metadata items with clear structure
    const metadataItems = [
        {
            label: 'Owner',
            value: `<span class="tx-owner">${txNode.owner.address}</span>`
        },
        {
            label: 'Block',
            value: txNode.block ? txNode.block.height : 'Pending'
        },
        {
            label: 'Timestamp',
            value: timestamp
        },
        {
            label: 'Data Size',
            value: dataSize
        }
    ];
    
    // Generate metadata HTML
    const metadataHtml = metadataItems.map(item => `
        <div class="tx-meta-item">
            <span class="tx-label">${item.label}</span>
            <span>${item.value}</span>
        </div>
    `).join('');
    
    // Check if we're in iframe embed mode
    if (document.body.classList.contains('iframe-embed')) {
        // iframe mode: Show transaction in iframe format
        const resultContainer = document.createElement('div');
        resultContainer.className = 'result-container';
        
        const resultDisplay = document.createElement('div');
        resultDisplay.className = 'result-display active';
        
        // Create a scrollable container for transaction content
        resultDisplay.innerHTML = `
            <div class="term"> ${txNode.id}</div>
            <div class="category">Transaction: ${contentType}</div>
            <div class="definition">
                ${metadataHtml}
            </div>
            ${txNode.tags && txNode.tags.length > 0 ? `
                <div class="tx-tags">
                    ${txNode.tags.map(tag => `
                        <div class="tx-tag">
                            <span class="tag-name">${tag.name}</span>: 
                            <span class="tag-value">${tag.value}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            <div class="docs-link tx-links">
                <a href="https://viewblock.io/arweave/tx/${txNode.id}" target="_blank" rel="noopener noreferrer">View on ViewBlock</a>
                <a href="https://arweave.net/${txNode.id}" target="_blank" rel="noopener noreferrer">View on Gateway</a>
            </div>
            <div class="result-footer">
                <div class="result-count">Transaction Details</div>
            </div>
        `;
        
        resultContainer.appendChild(resultDisplay);
        resultsContainer.appendChild(resultContainer);
        
        // Ensure result is visible
        resultDisplay.classList.add('active');
        // Force reflow
        resultDisplay.offsetHeight;
    } else {
        // Standard mode: Show transaction as a result item
        const txResult = document.createElement('div');
        txResult.className = 'result-item tx-result';
        txResult.setAttribute('tabindex', '0'); // Make focusable for keyboard navigation
        
        // Create transaction content
        txResult.innerHTML = `
            <div class="term">${txNode.id}</div>
            <div class="category">Transaction: ${contentType}</div>
            <div class="definition">
                ${metadataHtml}
            </div>
        `;
        
        // Add tags section (similar to related terms)
        if (txNode.tags && txNode.tags.length > 0) {
            const tagsContainer = document.createElement('div');
            tagsContainer.className = 'related-terms tx-tags';
            
            txNode.tags.forEach(tag => {
                const tagElement = document.createElement('div');
                tagElement.className = 'related-tag tx-tag';
                tagElement.innerHTML = `
                    <span class="tag-name">${tag.name}</span>: 
                    <span class="tag-value">${tag.value}</span>
                `;
                tagsContainer.appendChild(tagElement);
            });
            
            txResult.appendChild(tagsContainer);
        }
        
        // Add links section (similar to docs link)
        const linksContainer = document.createElement('div');
        linksContainer.className = 'docs-link tx-links';
        linksContainer.innerHTML = `
            <a href="https://viewblock.io/arweave/tx/${txNode.id}" target="_blank" rel="noopener noreferrer">View on ViewBlock</a>
            <a href="https://arweave.net/${txNode.id}" target="_blank" rel="noopener noreferrer">View on Gateway</a>
        `;
        
        txResult.appendChild(linksContainer);
        
        // Add to results container
        resultsContainer.appendChild(txResult);
    }
    
    // Add has-results class to containers
    resultsContainer.classList.add('has-results');
    document.querySelector('.search-container').classList.add('has-results');
    
    // Initialize keyboard navigation for transaction results
    if (window.keyboardNav) {
        window.keyboardNav.reset();
        window.keyboardNav.addMouseHandlers();
    }
}

// Format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Perform search using FlexSearch with enhanced options
function performSearch(query) {
    try {
        if (!searchIndex) {
            throw new Error('Search index not initialized');
        }
        
        // Generate query variations for better fuzzy matching
        const queryVariations = generateQueryVariations(query);
        
        // Search in term, definition, and aliases with all query variations
        let allResults = [];
        
        // Search with the original query
        const mainResults = searchIndex.search(query, {
            enrich: true,
            limit: 10
        });
        
        allResults = [...mainResults];
        
        // Search with query variations for better fuzzy matching
        queryVariations.forEach(variation => {
            if (variation !== query) {
                const variationResults = searchIndex.search(variation, {
                    enrich: true,
                    limit: 5
                });
                
                allResults = [...allResults, ...variationResults];
            }
        });
        
        // Process and display results
        const processedResults = processSearchResults(allResults, query);
        displayResults(processedResults);
    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = `<div class="error-message">Search error: ${error.message}</div>`;
        resultsContainer.classList.add('has-results');
    }
}

// Generate query variations for better fuzzy matching
function generateQueryVariations(query) {
    // For very short queries, don't generate variations
    if (query.length < 3) return [query];
    
    const variations = new Set([query]);
    const words = query.toLowerCase().split(/\s+/);
    
    // Process each word to generate useful variations
    words.forEach(word => {
        // Skip very short words
        if (word.length < 3) return;
        
        // Add stemmed variations (focus on most common suffixes)
        if (word.endsWith('ing')) {
            variations.add(word.slice(0, -3)); // swimming -> swim
        } else if (word.endsWith('ed')) {
            variations.add(word.slice(0, -2)); // walked -> walk
        } else if (word.endsWith('s') && !word.endsWith('ss')) {
            variations.add(word.slice(0, -1)); // cats -> cat
        } else if (word.endsWith('es')) {
            variations.add(word.slice(0, -2)); // boxes -> box
        } else if (word.endsWith('ies')) {
            variations.add(word.slice(0, -3) + 'y'); // countries -> country
        }
        
        // Add the word without non-alphanumeric characters
        const alphaNumericOnly = word.replace(/[^a-z0-9]/g, '');
        if (alphaNumericOnly !== word && alphaNumericOnly.length > 2) {
            variations.add(alphaNumericOnly);
        }
    });
    
    // For multi-word queries, add variations with different word combinations
    if (words.length > 1) {
        // Add without stop words 
        const stopWords = ['the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'as', 'of'];
        const filteredWords = words.filter(w => !stopWords.includes(w) && w.length > 2);
        if (filteredWords.length > 0 && filteredWords.length !== words.length) {
            variations.add(filteredWords.join(' '));
        }
    }
    
    return [...variations];
}

// Process search results from FlexSearch
function processSearchResults(results, query) {
    // Flatten and deduplicate results
    const flatResults = [];
    const seenIds = new Set();
    const exactTermMatches = []; // Store exact term matches (highest priority)
    const exactAliasMatches = []; // Store exact alias matches (second priority)
    const partialMatches = []; // Store partial matches (third priority)
    
    // Process results from each field
    results.forEach(resultSet => {
        resultSet.result.forEach(item => {
            const id = item.id;
            if (!seenIds.has(id)) {
                seenIds.add(id);
                
                // Get the original glossary item
                const glossaryItem = glossaryData[parseInt(id)];
                
                // Check for verbatim match first (returns 2 for exact term, 1 for exact alias, 0.9 for word match, 0 for no match)
                const verbatimMatchScore = checkVerbatimMatch(glossaryItem, query);
                
                // Calculate a semantic-like relevance score (0-1)
                let score = calculateSemanticLikeScore(glossaryItem, query);
                
                // Categorize based on match type
                if (verbatimMatchScore === 2) {
                    // Exact term match (highest priority)
                    exactTermMatches.push({
                        ...glossaryItem,
                        score: 2.0 // Ensure exact term matches always appear first
                    });
                } else if (verbatimMatchScore === 1) {
                    // Exact alias match (second priority)
                    exactAliasMatches.push({
                        ...glossaryItem,
                        score: 1.5 // Ensure exact alias matches appear after exact term matches
                    });
                } else if (verbatimMatchScore === 0.9) {
                    // Word match in term (third priority)
                    partialMatches.push({
                        ...glossaryItem,
                        score: 1.0 + score * 0.1 // Ensure word matches appear after exact matches
                    });
                } else {
                    // Regular match
                    flatResults.push({
                        ...glossaryItem,
                        score: score
                    });
                }
            }
        });
    });
    
    // Combine all results in priority order
    const combinedResults = [
        ...exactTermMatches,
        ...exactAliasMatches,
        ...partialMatches,
        ...flatResults
    ];
    
    // Sort by score (highest first) and take top results
    return combinedResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 15);
}

// Check for verbatim/keyword matches
function checkVerbatimMatch(item, query) {
    const queryLower = query.toLowerCase();
    
    // Check exact term match
    if (item.term.toLowerCase() === queryLower) {
        // Return 2 for exact term match (highest priority)
        return 2;
    }
    
    // Check aliases for exact matches
    if (item.aliases && item.aliases.some(alias => alias.toLowerCase() === queryLower)) {
        // Return 1 for exact alias match (second priority)
        return 1;
    }
    
    // Check if query is a complete word in the term
    const termWords = item.term.toLowerCase().split(/[-\s]+/);
    if (termWords.includes(queryLower)) {
        // Return 0.9 for word match in term (third priority)
        return 0.9;
    }
    
    // No verbatim match
    return 0;
}

// Calculate a semantic-like relevance score
function calculateSemanticLikeScore(item, query) {
    const queryLower = query.toLowerCase();
    const termLower = item.term.toLowerCase();
    const defLower = item.definition.toLowerCase();
    
    // Base score components
    let exactMatchScore = 0;
    let partialMatchScore = 0;
    let contextMatchScore = 0;
    
    // Exact match in term (highest priority)
    if (termLower === queryLower) {
        exactMatchScore = 1.0;
    } 
    // Prefix match in term
    else if (termLower.startsWith(queryLower)) {
        exactMatchScore = 0.8;
    }
    // Term contains query as a complete word
    else if (termLower.split(/[-\s]+/).includes(queryLower)) {
        exactMatchScore = 0.7;
    }
    // Term contains query
    else if (termLower.includes(queryLower)) {
        exactMatchScore = 0.6;
    }
    
    // Check for word matches in definition
    const queryWords = queryLower.split(/\s+/);
    let wordMatchCount = 0;
    
    queryWords.forEach(word => {
        if (word.length > 2 && defLower.includes(word)) {
            wordMatchCount++;
        }
    });
    
    if (queryWords.length > 0) {
        partialMatchScore = wordMatchCount / queryWords.length * 0.5;
    }
    
    // Check for aliases match
    if (item.aliases && item.aliases.length > 0) {
        const aliasesLower = item.aliases.map(a => a.toLowerCase());
        if (aliasesLower.some(alias => alias === queryLower)) {
            partialMatchScore += 0.4; // Boost exact alias matches
        } else if (aliasesLower.some(alias => alias.includes(queryLower))) {
            partialMatchScore += 0.3;
        }
    }
    
    // Check for related terms match
    if (item.related && item.related.length > 0) {
        const relatedLower = item.related.map(r => r.toLowerCase());
        if (relatedLower.some(rel => rel === queryLower)) {
            contextMatchScore += 0.3; // Boost exact related term matches
        } else if (relatedLower.some(rel => rel.includes(queryLower))) {
            contextMatchScore += 0.2;
        }
    }
    
    // Calculate character-level similarity for fuzzy matching
    const similarity = calculateStringSimilarity(termLower, queryLower);
    const fuzzySimilarityScore = similarity * 0.4;
    
    // Combine scores with appropriate weights
    const finalScore = Math.min(1.0, 
        exactMatchScore + 
        partialMatchScore + 
        contextMatchScore + 
        fuzzySimilarityScore
    );
    
    return finalScore;
}

// Calculate string similarity (Levenshtein-based)
function calculateStringSimilarity(str1, str2) {
    // For very different length strings, return low similarity
    if (Math.abs(str1.length - str2.length) > 5) {
        return 0.1;
    }
    
    // Simple character-level similarity
    let matches = 0;
    const maxLength = Math.max(str1.length, str2.length);
    
    // Count matching characters
    for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
        if (str1[i] === str2[i]) {
            matches++;
        }
    }
    
    // Calculate similarity ratio
    return matches / maxLength;
}

// Function to make terms in definitions clickable
function makeTermsClickable(definition, allTerms) {
    // Create a map of terms for quick lookup
    const termMap = new Map();
    const aliasMap = new Map(); // Track which term an alias belongs to
    
    allTerms.forEach(term => {
        termMap.set(term.term.toLowerCase(), term.term);
        
        // Also add aliases
        if (term.aliases && term.aliases.length > 0) {
            term.aliases.forEach(alias => {
                termMap.set(alias.toLowerCase(), term.term);
                aliasMap.set(alias.toLowerCase(), { 
                    originalTerm: term.term,
                    isAlias: true,
                    aliasText: alias
                });
            });
        }
    });
    
    // Sort terms by length (longest first) to avoid partial replacements
    const sortedTerms = Array.from(termMap.keys())
        .filter(term => term.length > 2) // Only consider terms with more than 2 characters
        .sort((a, b) => b.length - a.length);
    
    // Create a temporary element to hold the definition
    const tempElement = document.createElement('div');
    tempElement.innerHTML = definition;
    
    // Process text nodes only (to preserve HTML structure)
    function processTextNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            
            // Find all term matches in the text
            let matches = [];
            sortedTerms.forEach(termLower => {
                const originalTerm = termMap.get(termLower);
                // Use regex to find the term with word boundaries
                const regex = new RegExp(`\\b${termLower}\\b`, 'gi');
                let match;
                while ((match = regex.exec(text)) !== null) {
                    const aliasInfo = aliasMap.get(termLower);
                    matches.push({
                        index: match.index,
                        length: match[0].length,
                        matchedText: match[0],
                        originalTerm: originalTerm,
                        isAlias: aliasInfo ? true : false,
                        aliasText: aliasInfo ? aliasInfo.aliasText : null
                    });
                }
            });
            
            // Sort matches by index (to process from end to beginning)
            matches.sort((a, b) => b.index - a.index);
            
            // Filter out overlapping matches, keeping only the longest ones
            const filteredMatches = [];
            for (const match of matches) {
                // Check if this match overlaps with any existing filtered match
                const overlaps = filteredMatches.some(existing => {
                    // Check for overlap
                    const matchEnd = match.index + match.length;
                    const existingEnd = existing.index + existing.length;
                    return (match.index < existingEnd && existing.index < matchEnd);
                });
                
                // Only add if it doesn't overlap with any existing match
                if (!overlaps) {
                    filteredMatches.push(match);
                }
            }
            
            // Only replace if we found matches
            if (filteredMatches.length > 0) {
                // Create a document fragment to hold the new content
                const fragment = document.createDocumentFragment();
                let lastIndex = text.length;
                
                // Process matches from end to beginning to avoid index shifts
                for (const match of filteredMatches) {
                    // Add text after this match and before the next match
                    if (match.index + match.length < lastIndex) {
                        const textAfter = document.createTextNode(
                            text.substring(match.index + match.length, lastIndex)
                        );
                        fragment.prepend(textAfter);
                    }
                    
                    // Add the clickable span for this match
                    const clickableSpan = document.createElement('span');
                    clickableSpan.className = 'clickable-term';
                    clickableSpan.setAttribute('data-term', match.originalTerm);
                    
                    // If it's an alias, add a data attribute to indicate this
                    if (match.isAlias) {
                        clickableSpan.setAttribute('data-is-alias', 'true');
                        clickableSpan.setAttribute('data-alias-text', match.aliasText);
                    }
                    
                    clickableSpan.textContent = match.matchedText; // Preserve exact matched text
                    fragment.prepend(clickableSpan);
                    
                    lastIndex = match.index;
                }
                
                // Add any remaining text at the beginning
                if (lastIndex > 0) {
                    const textBefore = document.createTextNode(text.substring(0, lastIndex));
                    fragment.prepend(textBefore);
                }
                
                // Replace the original node with our fragment
                node.parentNode.replaceChild(fragment, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Skip processing if this is already a clickable term
            if (node.classList && node.classList.contains('clickable-term')) {
                return;
            }
            
            // Process child nodes
            Array.from(node.childNodes).forEach(processTextNodes);
        }
    }
    
    // Process all text nodes in the definition
    Array.from(tempElement.childNodes).forEach(processTextNodes);
    
    return tempElement.innerHTML;
}

// Display search results in the UI
function displayResults(results) {
    // Clear previous results
    resultsContainer.innerHTML = '';
    
    // If no results, show a message
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <p>No matching terms found.</p>
                <p>Try a different search term or check your spelling.</p>
            </div>
        `;
        // Always ensure the container is visible when displaying results
        resultsContainer.classList.add('has-results');
        document.querySelector('.search-container').classList.add('has-results');
        return;
    }
    
    // Store results in a global variable for navigation
    window.currentResults = results;
    window.currentResultIndex = 0;
    
    if (isIframeEmbed()) {
        // iframe mode: Show one result at a time with navigation
        const resultContainer = document.createElement('div');
        resultContainer.className = 'result-container';

        // Create result displays
        results.forEach((result, index) => {
            const resultDisplay = document.createElement('div');
            resultDisplay.className = `result-display${index === 0 ? ' active' : ''}`;
            
            // Create navigation buttons
            const prevButton = document.createElement('button');
            prevButton.className = 'nav-button prev';
            prevButton.innerHTML = '←';
            prevButton.disabled = index === 0;
            prevButton.onclick = () => navigateResults(-1);

            const nextButton = document.createElement('button');
            nextButton.className = 'nav-button next';
            nextButton.innerHTML = '→';
            nextButton.disabled = index === results.length - 1;
            nextButton.onclick = () => navigateResults(1);
            
            // Create the content with clickable terms
            const definitionWithClickableTerms = makeTermsClickable(result.definition, glossaryData);
            
            resultDisplay.innerHTML = `
                <div class="term">${result.term}</div>
                <div class="category">${result.category}</div>
                <div class="definition">${definitionWithClickableTerms}</div>
                ${result.aliases && result.aliases.length > 0 ? `<div class="aliases"><strong>Also known as:</strong> ${result.aliases.join(', ')}</div>` : ''}
                ${result.related && result.related.length > 0 ? `
                    <div class="related-terms">
                        ${result.related.map(term => `<span class="related-tag" data-term="${term}">${term}</span>`).join('')}
                    </div>
                ` : ''}
                ${result.docs && result.docs.length > 0 ? `
                    <div class="docs-link">
                        <a href="${result.docs[0]}" target="_blank" rel="noopener noreferrer">Learn more →</a>
                    </div>
                ` : ''}
                <div class="result-footer">
                    <div class="result-count">Result ${index + 1} of ${results.length}</div>
                </div>
            `;
            
            // Add navigation buttons to the footer
            const resultFooter = resultDisplay.querySelector('.result-footer');
            if (resultFooter) {
                resultFooter.appendChild(prevButton);
                resultFooter.appendChild(nextButton);
            }
            
            resultContainer.appendChild(resultDisplay);
        });

        resultsContainer.appendChild(resultContainer);

        // Ensure first result is visible
        const firstResult = resultContainer.querySelector('.result-display');
        if (firstResult) {
            firstResult.classList.add('active');
            // Force reflow
            firstResult.offsetHeight;
        }
    } else {
        // Original standalone mode: Show all results
        // Create a container for the results
        const resultsList = document.createElement('div');
        resultsList.className = 'results-list';
        
        // Add each result to the list
        results.forEach((result, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.setAttribute('data-index', index);
            
            // Create the result content
            const resultContent = document.createElement('div');
            resultContent.className = 'result-content';
            
            // Add the term
            const termElement = document.createElement('div');
            termElement.className = 'term';
            termElement.textContent = result.term;
            resultContent.appendChild(termElement);
            
            // Add the category
            const categoryElement = document.createElement('div');
            categoryElement.className = 'category';
            categoryElement.textContent = result.category;
            resultContent.appendChild(categoryElement);
            
            // Add the definition
            const definitionElement = document.createElement('div');
            definitionElement.className = 'definition';
            
            // Make terms in the definition clickable
            definitionElement.innerHTML = makeTermsClickable(result.definition, glossaryData);
            resultContent.appendChild(definitionElement);
            
            // Add aliases if available
            if (result.aliases && result.aliases.length > 0) {
                const aliasesElement = document.createElement('div');
                aliasesElement.className = 'aliases';
                aliasesElement.innerHTML = `<strong>Also known as:</strong> ${result.aliases.join(', ')}`;
                resultContent.appendChild(aliasesElement);
            }
            
            // Add related terms if available
            if (result.related && result.related.length > 0) {
                const relatedElement = document.createElement('div');
                relatedElement.className = 'related-terms';
                
                // Add each related term as a clickable tag
                result.related.forEach(relatedTerm => {
                    const relatedTag = document.createElement('span');
                    relatedTag.className = 'related-tag';
                    relatedTag.textContent = relatedTerm;
                    relatedTag.setAttribute('data-term', relatedTerm);
                    relatedElement.appendChild(relatedTag);
                });
                
                resultContent.appendChild(relatedElement);
            }
            
            // Add documentation links if available
            if (result.docs && result.docs.length > 0) {
                const docsElement = document.createElement('div');
                docsElement.className = 'docs-link';
                
                // Add the primary "Learn more" link
                if (result.docs[0]) {
                    const mainLink = document.createElement('a');
                    mainLink.href = result.docs[0];
                    mainLink.target = '_blank';
                    mainLink.rel = 'noopener noreferrer';
                    mainLink.textContent = 'Learn more →';
                    docsElement.appendChild(mainLink);
                }
                
                resultContent.appendChild(docsElement);
            }
            
            resultItem.appendChild(resultContent);
            resultsList.appendChild(resultItem);
        });
        
        // Add the results to the container
        resultsContainer.appendChild(resultsList);
        
        // Auto-select the first result if keyboard navigation is active
        if (isKeyboardActive) {
            const firstResult = resultsList.querySelector('.result-item');
            if (firstResult) {
                firstResult.classList.add('selected');
                // Ensure the selected item is visible at the top of the viewport
                setTimeout(() => {
                    firstResult.scrollIntoView({
                        behavior: 'auto',
                        block: 'start'
                    });
                }, 0);
            }
        }
    }

    // Always ensure the container is visible when displaying results
    resultsContainer.classList.add('has-results');
    document.querySelector('.search-container').classList.add('has-results');
    
    // First instance - clickable terms
    document.querySelectorAll('.clickable-term').forEach(element => {
        element.addEventListener('click', function(e) {
            // Prevent the default behavior and stop propagation
            e.preventDefault();
            e.stopPropagation();
            
            const term = this.getAttribute('data-term');
            if (term) {
                // Set the flag to indicate we're navigating between terms
                isNavigatingBetweenTerms = true;
                
                // Ensure the container stays open
                resultsContainer.classList.add('has-results');
                document.querySelector('.search-container').classList.add('has-results');
                
                searchInput.value = term;
                // Directly perform the search without waiting for the input event
                performSearch(term);
                
                // Reset the flag immediately - no need for delay since we removed animations
                isNavigatingBetweenTerms = false;
            }
        });
    });
    
    // Second instance - related tags
    document.querySelectorAll('.related-tag').forEach(element => {
        element.addEventListener('click', function(e) {
            // Prevent the default behavior and stop propagation
            e.preventDefault();
            e.stopPropagation();
            
            const term = this.getAttribute('data-term');
            if (term) {
                // Set the flag to indicate we're navigating between terms
                isNavigatingBetweenTerms = true;
                
                // Ensure the container stays open
                resultsContainer.classList.add('has-results');
                document.querySelector('.search-container').classList.add('has-results');
                
                searchInput.value = term;
                // Directly perform the search without waiting for the input event
                performSearch(term);
                
                // Reset the flag immediately - no need for delay since we removed animations
                isNavigatingBetweenTerms = false;
            }
        });
    });
}

function navigateResults(direction) {
    const results = document.querySelectorAll('.result-display');
    if (!results.length) return;

    // Ensure the container stays visible
    resultsContainer.classList.add('has-results');
    document.querySelector('.search-container').classList.add('has-results');

    const currentIndex = window.currentResultIndex || 0;
    const newIndex = (currentIndex + direction + results.length) % results.length;

    const currentResult = results[currentIndex];
    if (currentResult) {
        currentResult.classList.remove('active');
        currentResult.style.display = 'none'; // Explicitly hide to ensure consistency
    }

    const nextResult = results[newIndex];
    if (nextResult) {
        nextResult.classList.add('active');
        // CSS will handle display: flex !important, no need for inline style
    }

    window.currentResultIndex = newIndex;
    
    // Update all navigation buttons
    results.forEach((result, index) => {
        const footer = result.querySelector('.result-footer');
        if (footer) {
            const prevButton = footer.querySelector('.nav-button.prev');
            const nextButton = footer.querySelector('.nav-button.next');
            
            if (prevButton) {
                prevButton.disabled = index === 0;
                prevButton.setAttribute('aria-label', index === 0 ? 'No previous results' : 'Previous result');
            }
            
            if (nextButton) {
                nextButton.disabled = index === results.length - 1;
                nextButton.setAttribute('aria-label', index === results.length - 1 ? 'No more results' : 'Next result');
            }
        }
    });

    // Debug logging
    console.log('Navigation:', {
        direction,
        newIndex,
        activeResult: nextResult ? 'visible' : 'not found'
    });
}

// Add click handler to close results when clicking outside
document.addEventListener('click', (e) => {
    // Don't close results if we're navigating between terms
    if (isNavigatingBetweenTerms) return;
    
    // Don't close if clicking on a clickable term or related tag
    if (e.target.classList.contains('clickable-term') || e.target.classList.contains('related-tag')) return;
    
    if (!resultsContainer.contains(e.target) && e.target !== searchInput) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.remove('has-results');
        document.querySelector('.search-container').classList.remove('has-results');
    }
});

function updateDisplay(results, currentIndex = 0) {
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) return;

    // Clear existing results
    resultsContainer.innerHTML = '';

    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <p>No matching terms found.</p>
                <p>Try a different search term or check your spelling.</p>
            </div>
        `;
        // Always ensure the container is visible
        resultsContainer.classList.add('has-results');
        document.querySelector('.search-container').classList.add('has-results');
        return;
    }

    // Create result container
    const resultContainer = document.createElement('div');
    resultContainer.className = 'result-container';

    // Create result displays
    results.forEach((result, index) => {
        const resultDisplay = document.createElement('div');
        resultDisplay.className = `result-display${index === currentIndex ? ' active' : ''}`;
        
        // Create navigation buttons
        const prevButton = document.createElement('button');
        prevButton.className = 'nav-button prev';
        prevButton.innerHTML = '←';
        prevButton.disabled = index === 0;
        prevButton.onclick = () => navigateResults(-1);

        const nextButton = document.createElement('button');
        nextButton.className = 'nav-button next';
        nextButton.innerHTML = '→';
        nextButton.disabled = index === results.length - 1;
        nextButton.onclick = () => navigateResults(1);
        
        // Create the content with clickable terms
        const definitionWithClickableTerms = makeTermsClickable(result.definition, glossaryData);
        
        resultDisplay.innerHTML = `
            <div class="term">${result.term}</div>
            <div class="category">${result.category}</div>
            ${result.aliases && result.aliases.length > 0 ? `<div class="aliases"><strong>Also known as:</strong> ${result.aliases.join(', ')}</div>` : ''}
            <div class="definition">${definitionWithClickableTerms}</div>
            ${result.related && result.related.length > 0 ? `
                <div class="related-terms">
                    ${result.related.map(term => `<span class="related-tag" data-term="${term}">${term}</span>`).join('')}
                </div>
            ` : ''}
            ${result.docs && result.docs.length > 0 ? `
                <div class="docs-link">
                    <a href="${result.docs[0]}" target="_blank" rel="noopener noreferrer">Learn more →</a>
                </div>
            ` : ''}
            <div class="result-footer">
                <div class="result-count">Result ${index + 1} of ${results.length}</div>
            </div>
        `;
        
        // Add navigation buttons to the footer
        const resultFooter = resultDisplay.querySelector('.result-footer');
        if (resultFooter) {
            resultFooter.appendChild(prevButton);
            resultFooter.appendChild(nextButton);
        }
        
        resultContainer.appendChild(resultDisplay);
    });

    resultsContainer.appendChild(resultContainer);

    // Add event listeners for clickable terms
    document.querySelectorAll('.clickable-term').forEach(element => {
        element.addEventListener('click', function(e) {
            // Prevent the default behavior and stop propagation
            e.preventDefault();
            e.stopPropagation();
            
            const term = this.getAttribute('data-term');
            if (term) {
                // Set the flag to indicate we're navigating between terms
                isNavigatingBetweenTerms = true;
                
                // Ensure the container stays open
                resultsContainer.classList.add('has-results');
                document.querySelector('.search-container').classList.add('has-results');
                
                searchInput.value = term;
                // Directly perform the search without waiting for the input event
                performSearch(term);
                
                // Reset the flag immediately - no need for delay since we removed animations
                isNavigatingBetweenTerms = false;
            }
        });
    });
    
    // Add event listeners for related tags
    document.querySelectorAll('.related-tag').forEach(element => {
        element.addEventListener('click', function(e) {
            // Prevent the default behavior and stop propagation
            e.preventDefault();
            e.stopPropagation();
            
            const term = this.getAttribute('data-term');
            if (term) {
                // Set the flag to indicate we're navigating between terms
                isNavigatingBetweenTerms = true;
                
                // Ensure the container stays open
                resultsContainer.classList.add('has-results');
                document.querySelector('.search-container').classList.add('has-results');
                
                searchInput.value = term;
                // Directly perform the search without waiting for the input event
                performSearch(term);
                
                // Reset the flag immediately - no need for delay since we removed animations
                isNavigatingBetweenTerms = false;
            }
        });
    });
}

// Add visibility check on load
document.addEventListener('DOMContentLoaded', () => {
    const checkVisibility = setInterval(() => {
        const results = document.querySelectorAll('.result-display');
        const activeResult = document.querySelector('.result-display.active');
        
        if (activeResult && activeResult.style.opacity !== '1') {
            activeResult.style.display = 'flex';
            activeResult.style.opacity = '1';
        }
        
        if (results.length) clearInterval(checkVisibility);
    }, 500);
});

// Start the application
document.addEventListener('DOMContentLoaded', init);

// Function to create and display random term tags
function createRandomTermTags() {
    if (!glossaryData || glossaryData.length === 0) return;
    
    // Create the container for random term tags
    const searchContainer = document.querySelector('.search-container');
    if (!searchContainer) return;
    
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'random-terms-container';
    
    const termsContainer = document.createElement('div');
    termsContainer.className = 'related-terms random-terms';
    
    // Apply justification based on the stored preference (if we're in iframe mode)
    if (isIframeEmbed() && window.randomTermsJustification) {
        termsContainer.style.justifyContent = window.randomTermsJustification;
    }
    
    // Get initial shuffled terms
    shuffledTerms = getShuffledTerms(glossaryData);
    
    // Function to calculate and render the appropriate number of tags
    function renderTags() {
        // Clear existing tags
        termsContainer.innerHTML = '';
        
        // Ensure justification is still applied when re-rendering
        if (isIframeEmbed() && window.randomTermsJustification) {
            termsContainer.style.justifyContent = window.randomTermsJustification;
        }
        
        // Get container width
        const containerWidth = searchContainer.clientWidth - 60; // Allow padding
        
        // Create a temporary container to measure tag widths
        const tempContainer = document.createElement('div');
        tempContainer.style.visibility = 'hidden';
        tempContainer.style.position = 'absolute';
        tempContainer.style.display = 'flex';
        document.body.appendChild(tempContainer);
        
        // Start with a reasonable minimum number of tags
        const minTags = 3;
        let tagsToShow = [];
        let currentWidth = 0;
        
        // Try adding tags one by one until we run out of space
        for (let i = 0; i < shuffledTerms.length; i++) {
            const term = shuffledTerms[i];
            
            // Create a temp tag to measure its width
            const tempTag = document.createElement('span');
            tempTag.className = 'related-tag';
            tempTag.textContent = term;
            tempContainer.appendChild(tempTag);
            
            // Get the actual width including margins
            const tagWidth = tempTag.offsetWidth + 6; // Add margin (3px on each side)
            
            // Check if adding this tag would exceed the container width
            if (currentWidth + tagWidth > containerWidth && tagsToShow.length >= minTags) {
                break; // Stop adding tags if we've reached the minimum and would overflow
            }
            
            // Otherwise, add this tag
            tagsToShow.push(term);
            currentWidth += tagWidth;
        }
        
        // Clean up the temporary container
        document.body.removeChild(tempContainer);
        
        // Create the actual visible tags
        tagsToShow.forEach(term => {
            const tag = document.createElement('span');
            tag.className = 'related-tag';
            tag.textContent = term;
            tag.setAttribute('data-term', term);
            
            // Add click event to populate search bar
            tag.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Set search input value to this term
                searchInput.value = term;
                // Directly perform the search
                performSearch(term);
                
                // Focus the search input
                searchInput.focus();
            });
            
            termsContainer.appendChild(tag);
        });
    }
    
    // Store render function globally so it can be called when search changes
    window.renderRandomTags = renderTags;
    
    // Initial render
    renderTags();
    
    // Add window resize listener to update tags on window resize
    window.addEventListener('resize', debounce(renderTags, 200));
    
    tagsContainer.appendChild(termsContainer);
    
    // Insert after the search input container
    const searchInputContainer = searchContainer.querySelector('.search-input');
    if (searchInputContainer) {
        searchInputContainer.insertAdjacentElement('afterend', tagsContainer);
    } else {
        searchContainer.appendChild(tagsContainer);
    }
}

// Function to reshuffle and update term tags
function reshuffleTermTags() {
    if (!glossaryData || glossaryData.length === 0) return;
    
    // Reshuffle the terms
    shuffledTerms = getShuffledTerms(glossaryData);
    
    // Also ensure justification is maintained for any existing random-terms elements
    if (isIframeEmbed() && window.randomTermsJustification) {
        document.querySelectorAll('.iframe-embed .random-terms').forEach(el => {
            el.style.justifyContent = window.randomTermsJustification;
        });
    }
    
    // Render the new tags if the render function exists
    if (window.renderRandomTags) {
        window.renderRandomTags();
    }
}

// Simple debounce function for resize events
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

// Function to get shuffled terms from the glossary data
function getShuffledTerms(glossary) {
    // Create a copy of the glossary items to avoid modifying the original
    const terms = [...glossary].map(item => item.term);
    
    // Shuffle the terms array using Fisher-Yates algorithm
    for (let i = terms.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [terms[i], terms[j]] = [terms[j], terms[i]];
    }
    
    return terms;
}

// Initialize theme based on user preference or stored preference
const initializeTheme = () => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
        document.documentElement.setAttribute('data-theme', storedTheme);
        updateThemeToggle(storedTheme);
        return;
    }
    
    const systemTheme = prefersDarkScheme.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', systemTheme);
    updateThemeToggle(systemTheme);
};

// Update theme toggle button appearance
const updateThemeToggle = (theme) => {
    // SVG icons are controlled by CSS, no need to update content
    document.documentElement.setAttribute('data-theme', theme);
};

// Handle theme toggle click
themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
});

// Listen for system theme changes
prefersDarkScheme.addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
        const newTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        updateThemeToggle(newTheme);
    }
});

// Initialize theme when the page loads
initializeTheme(); 
