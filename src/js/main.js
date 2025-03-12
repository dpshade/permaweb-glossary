// Constants for the application
const GLOSSARY_URL = '../src/data/glossary.json';

// State variables
let searchIndex = null;
let glossaryData = null;
let searchTimeout = null;

// DOM elements
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('results');
const loadingStatus = document.getElementById('loading-status');

// Initialize the application
async function init() {
    try {
        updateLoadingStatus('Loading glossary data...');
        
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
    
    results.forEach((result, index) => {
        // Create related terms tags if available
        const relatedTermsHtml = result.related && result.related.length > 0 
            ? `
                <div class="related-terms">
                    Related: ${result.related.map(term => 
                        `<span class="related-tag">${term}</span>`
                    ).join('')}
                </div>`
            : '';
            
        const aliasesHtml = result.aliases && result.aliases.length > 0
            ? `<p class="aliases">Also known as: ${result.aliases.join(', ')}</p>`
            : '';
            
        // Add documentation link if available
        const docsHtml = result.docs && result.docs.length > 0
            ? `<div class="docs-link">Documentation: <a href="${result.docs[0]}" target="_blank">${result.docs[0]}</a></div>`
            : '';
            
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        resultItem.setAttribute('data-index', index);
        
        resultItem.innerHTML = `
            <div class="term">${result.term}</div>
            <div class="category">Category: ${result.category}</div>
            <div class="definition">${result.definition}</div>
            ${aliasesHtml}
            ${relatedTermsHtml}
            ${docsHtml}
            <div class="score">Relevance: ${Math.round(result.score * 100)}%</div>
        `;
        
        resultItem.addEventListener('click', () => {
            // If docs are available, open the first one
            if (result.docs && result.docs.length > 0) {
                window.open(result.docs[0], '_blank');
            } else {
                // Otherwise, copy to clipboard
                copyToClipboard(result, index);
            }
        });
        
        resultsContainer.appendChild(resultItem);
    });
    
    resultsContainer.classList.add('has-results');
    document.querySelector('.search-container').classList.add('has-results');
    
    // Reset keyboard navigation and auto-select first result
    if (window.keyboardNav) {
        window.keyboardNav.reset();
        window.keyboardNav.addMouseHandlers();
    }
}

// Copy term and definition to clipboard
function copyToClipboard(result, index) {
    const text = `${result.term}: ${result.definition}`;
    
    navigator.clipboard.writeText(text)
        .then(() => {
            // Show a temporary "copied" message
            const resultItem = document.querySelector(`.result-item[data-index="${index}"]`);
            if (resultItem) {
                const copiedMsg = document.createElement('div');
                copiedMsg.className = 'copied-message';
                copiedMsg.textContent = 'Copied to clipboard!';
                resultItem.appendChild(copiedMsg);
                
                setTimeout(() => {
                    copiedMsg.remove();
                }, 2000);
            }
        })
        .catch(err => {
            console.error('Failed to copy text: ', err);
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

// Start the application
document.addEventListener('DOMContentLoaded', init); 