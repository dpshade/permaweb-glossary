// Constants for the application
const GLOSSARY_URL = '../src/data/glossary.json';

// State variables
let searchIndex = null;
let glossaryData = null;
let searchTimeout = null;
let activeIndex = 0;

// DOM elements
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('results');
const loadingStatus = document.getElementById('loading-status');

// Helper functions
function isIframeEmbed() {
    return document.body.classList.contains('iframe-embed');
}

// Function to check URL parameters for color customization
function checkUrlParamsForColors() {
    const urlParams = new URLSearchParams(window.location.search);
    console.log('URL Parameters:', window.location.search);
    
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
    
    console.log('Parsed color parameters:', colorParams);
    
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
            } else {
                console.warn(`Invalid color value for ${varName}:`, value);
            }
        }
    });
    
    if (colorsApplied) {
        console.log('Successfully applied colors:', appliedColors);
    } else {
        console.log('No valid colors found in URL parameters');
    }
    
    // Log current CSS variables
    const computedStyle = getComputedStyle(document.documentElement);
    console.log('Current CSS variables:', {
        '--ao-bg-color': computedStyle.getPropertyValue('--ao-bg-color'),
        '--ao-text-color': computedStyle.getPropertyValue('--ao-text-color'),
        '--ao-link-color': computedStyle.getPropertyValue('--ao-link-color')
    });
}

// Initialize the application
async function init() {
    try {
        updateLoadingStatus('Loading glossary data...');
        checkUrlParamsForColors();
        
        // Apply colors from URL parameters automatically
        if (isIframeEmbed()) {
            
            // Listen for messages from parent page for resize events only
            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'resize') {
                    // Handle resize events
                    console.log('Received resize event:', event.data);
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
    
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    // Clear results if query is empty
    if (!query) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.remove('has-results');
        document.querySelector('.search-container').classList.remove('has-results');
        return;
    }
    
    // Debounce search to avoid too many requests
    searchTimeout = setTimeout(() => {
        performSearch(query);
    }, 150); // Even faster response time
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
    const variations = [query];
    
    // Skip short queries
    if (query.length < 3) return variations;
    
    // Add common word stems and variations
    const words = query.toLowerCase().split(/\s+/);
    
    words.forEach(word => {
        // Skip very short words
        if (word.length < 4) return;
        
        // Add stemmed versions (simple stemming)
        if (word.endsWith('ing')) {
            variations.push(word.slice(0, -3));
            variations.push(word.slice(0, -3) + 'e');
        } else if (word.endsWith('ed')) {
            variations.push(word.slice(0, -2));
            variations.push(word.slice(0, -1));
        } else if (word.endsWith('s')) {
            variations.push(word.slice(0, -1));
        } else if (word.endsWith('es')) {
            variations.push(word.slice(0, -2));
        }
        
        // Add character swaps for common typos
        for (let i = 0; i < word.length - 1; i++) {
            const swapped = word.slice(0, i) + word[i+1] + word[i] + word.slice(i+2);
            variations.push(swapped);
        }
    });
    
    // Combine variations into new queries
    const singleWordVariations = [...new Set(variations)];
    
    // For multi-word queries, create combinations
    if (words.length > 1) {
        // Add the original words with each variation
        singleWordVariations.forEach(variation => {
            if (!words.includes(variation)) {
                variations.push(words.join(' ') + ' ' + variation);
            }
        });
    }
    
    return [...new Set(variations)];
}

// Process search results from FlexSearch
function processSearchResults(results, query) {
    // Flatten and deduplicate results
    const flatResults = [];
    const seenIds = new Set();
    const verbatimMatches = []; // Store verbatim matches separately
    
    // Process results from each field
    results.forEach(resultSet => {
        resultSet.result.forEach(item => {
            const id = item.id;
            if (!seenIds.has(id)) {
                seenIds.add(id);
                
                // Get the original glossary item
                const glossaryItem = glossaryData[parseInt(id)];
                
                // Check for verbatim match first
                const isVerbatimMatch = checkVerbatimMatch(glossaryItem, query);
                
                // Calculate a semantic-like relevance score (0-1)
                let score = calculateSemanticLikeScore(glossaryItem, query);
                
                // Boost score for verbatim matches
                if (isVerbatimMatch) {
                    score = 2.0; // Ensure verbatim matches always appear first
                    verbatimMatches.push({
                        ...glossaryItem,
                        score: score
                    });
                } else {
                    flatResults.push({
                        ...glossaryItem,
                        score: score
                    });
                }
            }
        });
    });
    
    // Combine verbatim matches with other results
    const combinedResults = [...verbatimMatches, ...flatResults];
    
    // Sort by score (highest first) and take top results
    return combinedResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
}

// Check for verbatim/keyword matches
function checkVerbatimMatch(item, query) {
    const queryLower = query.toLowerCase();
    
    // Check exact term match
    if (item.term.toLowerCase() === queryLower) {
        return true;
    }
    
    // Check aliases for exact matches
    if (item.aliases && item.aliases.some(alias => alias.toLowerCase() === queryLower)) {
        return true;
    }
    
    // Check if query is a complete word in the term
    const termWords = item.term.toLowerCase().split(/[-\s]+/);
    if (termWords.includes(queryLower)) {
        return true;
    }
    
    return false;
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
        exactMatchScore = 0.9;
    }
    // Term contains query as a complete word
    else if (termLower.split(/[-\s]+/).includes(queryLower)) {
        exactMatchScore = 0.85;
    }
    // Term contains query
    else if (termLower.includes(queryLower)) {
        exactMatchScore = 0.8;
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
        partialMatchScore = wordMatchCount / queryWords.length * 0.6;
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
    const fuzzySimilarityScore = similarity * 0.5;
    
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

// Display search results in the UI
function displayResults(results) {
    resultsContainer.innerHTML = '';
    
    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No matching terms found</div>';
        resultsContainer.classList.add('has-results');
        document.querySelector('.search-container').classList.add('has-results');
        return;
    }
    
    // Store results in a global variable for navigation
    window.currentResults = results;
    window.currentResultIndex = 0;

    if (document.body.classList.contains('iframe-embed')) {
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
            
            resultDisplay.innerHTML = `
                <div class="term">${result.term}</div>
                <div class="category">Category: ${result.category}</div>
                <div class="definition">${result.definition}</div>
                ${result.aliases ? `<div class="aliases">Also known as: ${result.aliases.join(', ')}</div>` : ''}
                ${result.related && result.related.length > 0 ? `
                    <div class="related-terms">
                        ${result.related.map(term => `<span class="related-tag">${term}</span>`).join('')}
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

        // Keyboard navigation is now handled in init function
    } else {
        // Original standalone mode: Show all results
        results.forEach((result, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.setAttribute('data-index', index);
            
            resultItem.innerHTML = `
                <div class="term">${result.term}</div>
                <div class="category">Category: ${result.category}</div>
                <div class="definition">${result.definition}</div>
                ${result.aliases ? `<div class="aliases">Also known as: ${result.aliases.join(', ')}</div>` : ''}
                ${result.related && result.related.length > 0 ? `
                    <div class="related-terms">
                        ${result.related.map(term => `<span class="related-tag">${term}</span>`).join('')}
                    </div>
                ` : ''}
                ${result.docs && result.docs.length > 0 ? `
                    <div class="docs-link">
                        <a href="${result.docs[0]}" target="_blank" rel="noopener noreferrer">Learn more →</a>
                    </div>
                ` : ''}
            `;
            
            resultsContainer.appendChild(resultItem);
        });
        
        // Auto-select the first result in standalone mode
        if (window.keyboardNav) {
            window.keyboardNav.addMouseHandlers();
            window.keyboardNav.reset();
        }
    }

    resultsContainer.classList.add('has-results');
    document.querySelector('.search-container').classList.add('has-results');
}

function navigateResults(direction) {
    const results = document.querySelectorAll('.result-display');
    if (!results.length) return;

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
                No matching terms found
            </div>
        `;
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
        
        resultDisplay.innerHTML = `
            <div class="term">${result.term}</div>
            <div class="category">${result.category}</div>
            <div class="definition">${result.definition}</div>
            ${result.aliases ? `<div class="aliases">Also known as: ${result.aliases}</div>` : ''}
            ${result.relatedTerms && result.relatedTerms.length > 0 ? `
                <div class="related-terms">
                    ${result.relatedTerms.map(term => `<span class="related-tag">${term}</span>`).join('')}
                </div>
            ` : ''}
            ${result.docsLink ? `
                <div class="docs-link">
                    <a href="${result.docsLink}" target="_blank" rel="noopener noreferrer">Learn more →</a>
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

    // Add the result container to the results container
    resultsContainer.appendChild(resultContainer);

    // Initialize active index and ensure visibility
    activeIndex = currentIndex;
    
    // Force reflow to ensure transition works
    const activeResult = resultContainer.querySelector('.result-display.active');
    if (activeResult) {
        activeResult.style.display = 'flex';
        // Force reflow
        activeResult.offsetHeight;
        activeResult.style.opacity = '1';
    }

    // Add debug logging
    console.log('Results updated:', {
        totalResults: results.length,
        activeIndex: currentIndex,
        activeResult: activeResult ? 'found' : 'not found'
    });
}

// Add visibility check on load
document.addEventListener('DOMContentLoaded', () => {
    const checkVisibility = setInterval(() => {
        const results = document.querySelectorAll('.result-display');
        const activeResult = document.querySelector('.result-display.active');
        
        console.log('Visibility check:', {
            results: results.length,
            activeResult: activeResult ? 'found' : 'not found'
        });
        
        if (activeResult && activeResult.style.opacity !== '1') {
            activeResult.style.display = 'flex';
            activeResult.style.opacity = '1';
        }
        
        if (results.length) clearInterval(checkVisibility);
    }, 500);
});

// Start the application
document.addEventListener('DOMContentLoaded', init); 