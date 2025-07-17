import { SearchManager } from './search-manager.js';
import { GlossarySearchProvider } from './glossary-search-provider.js';
import { DocumentationSearchProvider } from './documentation-search-provider.js';

// --- Constants ---
const NUM_RANDOM_TAGS = 5;

// --- Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => { })
            .catch(err => { });
    });
}

// --- DOM Elements ---
let searchInput;
let resultsContainer;
let loadingStatus;
let clickableTitle;
let themeToggle;

// --- State ---
let searchManager;
let glossaryDataForUI = null; // To help with rendering clickable terms
let currentRandomTermsMode = null; // Track the current mode for random terms
let randomTermsDisplayed = false; // Track if random terms have been displayed

// --- Initialization ---
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        // Initialize DOM elements
        searchInput = document.getElementById('searchInput');
        resultsContainer = document.getElementById('results');
        loadingStatus = document.getElementById('loading-status');
        clickableTitle = document.getElementById('clickableTitle');
        themeToggle = document.querySelector('.theme-toggle');
        
        applyQueryParameters();
        initializeTheme();

        if (isIframeEmbed()) {
            document.documentElement.classList.add('iframe-embed');
        }

        searchManager = new SearchManager();
        
        const glossaryProvider = new GlossarySearchProvider();
        searchManager.registerProvider('glossary', glossaryProvider);

        const documentationProvider = new DocumentationSearchProvider();
        searchManager.registerProvider('documentation', documentationProvider);
        
        searchManager.state.subscribe(handleStateChange);
        
        // Get initial mode from URL parameter
        const urlMode = getModeFromURL();
        const initialMode = urlMode || 'glossary';
        
        // Only update URL if we have a specific mode from URL
        // Don't force ?mode=glossary if no mode is specified
        if (urlMode) {
            updateURLWithMode(initialMode);
        }
        
        try {
            await searchManager.initialize(initialMode);
        } catch (error) {
            console.error('SearchManager initialization failed:', error);
        }
        
        // Pre-initialize other providers in background for faster mode switching
        setTimeout(() => {
            searchManager.preInitializeProviders();
        }, 1000); // Wait 1 second after main initialization
        
        // Expose searchManager globally for JSON API access
        window.searchManager = searchManager;
        
        // Expose glossary data for UI functions - must be after initialize
        // Use the original glossaryProvider reference since it should be the same instance
        
        // In glossary mode, the provider should already be initialized
        // In documentation mode, we need to ensure glossary provider is initialized for random terms
        if (initialMode === 'documentation' && !glossaryProvider.glossaryData) {
            await glossaryProvider.initialize();
        }
        
        glossaryDataForUI = glossaryProvider.glossaryData;

        initializeUIHandlers();

        const initialQuery = getSearchQueryFromURL();
        if (initialQuery) {
            searchInput.value = initialQuery;
            searchManager.performSearch(initialQuery);
        } else {
            updateRandomTermsIfNeeded(initialMode);
        }

        if (!isIframeEmbed()) {
            searchInput.focus();
        }

        // Add browser navigation support
        setupBrowserNavigation();

    } catch (error) {
        console.error('Initialization error:', error);
    }
}

function setupBrowserNavigation() {
    // Handle browser back/forward navigation
    window.addEventListener('popstate', async () => {
        const urlMode = getModeFromURL();
        const urlQuery = getSearchQueryFromURL();
        const currentMode = searchManager?.state?.mode;
        
        // If URL mode differs from current mode, switch modes
        if (urlMode && urlMode !== currentMode && searchManager?.searchProviders?.has(urlMode)) {
            try {
                await searchManager.switchMode(urlMode);
            } catch (error) {
                console.warn('Failed to switch mode on navigation:', error);
                // URL will be corrected by syncURLWithCurrentState
            }
        }
        
        // Update search input and perform search if needed
        if (urlQuery !== searchInput.value) {
            searchInput.value = urlQuery || '';
            if (urlQuery) {
                searchManager.performSearch(urlQuery);
            } else {
                // Clear results and show random tags
                resultsContainer.innerHTML = '';
                resultsContainer.classList.remove('has-results');
                document.querySelector('.search-container').classList.remove('has-results');
                randomTermsDisplayed = false; // Reset flag when navigating to empty search
                updateRandomTermsIfNeeded(searchManager?.state?.mode || 'glossary');
            }
        }
    });
}

function initializeUIHandlers() {
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value;
        updateURLWithSearch(query);
        
        // Reset random terms display flag when user starts typing
        if (query && randomTermsDisplayed) {
            randomTermsDisplayed = false;
        }
        
        searchTimeout = setTimeout(() => {
            searchManager.performSearch(query);
        }, 200);
    });

    // Add keyboard navigation support
    searchInput.addEventListener('keydown', (e) => {
        handleKeyboardNavigation(e);
    });

    clickableTitle.addEventListener('click', () => {
        const currentMode = searchManager.state.mode;
        const newMode = currentMode === 'glossary' ? 'documentation' : 'glossary';
        if (searchManager.searchProviders.has(newMode)) {
            // Update URL immediately to prevent race conditions
            updateURLWithMode(newMode);
            
            // Show loading state
            clickableTitle.textContent = 'Switching...';
            clickableTitle.style.opacity = '0.7';
            
            searchManager.switchMode(newMode, searchInput.value).then(() => {
                // Ensure glossaryDataForUI is available for glossary mode
                if (newMode === 'glossary') {
                    const glossaryProvider = searchManager.searchProviders.get('glossary');
                    if (glossaryProvider && glossaryProvider.glossaryData) {
                        glossaryDataForUI = glossaryProvider.glossaryData;
                    }
                }
                
                // If no query, clear results and show random tags
                if (!searchInput.value) {
                    resultsContainer.innerHTML = '';
                    resultsContainer.classList.remove('has-results');
                    document.querySelector('.search-container').classList.remove('has-results');
                    randomTermsDisplayed = false; // Reset flag when switching modes
                    updateRandomTermsIfNeeded(newMode);
                }
                
                // Auto-refocus the search input after mode toggle
                if (!isIframeEmbed()) {
                    searchInput.focus();
                }
            }).catch((error) => {
                console.error('Mode switch failed:', error);
                // Revert URL if mode switch failed
                updateURLWithMode(currentMode);
                
                // Show error feedback to user
                showTemporaryError('Failed to switch modes. Please try again.');
            }).finally(() => {
                // Restore normal state
                clickableTitle.style.opacity = '1';
            });
        } else {
            console.warn(`Provider for mode "${newMode}" not available yet.`);
            showTemporaryError(`Mode "${newMode}" is not available.`);
        }
    });

    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('clickable-term') || target.classList.contains('related-tag')) {
             e.preventDefault();
             e.stopPropagation();
             const term = target.getAttribute('data-term');
             if (term) {
                searchInput.value = term;
                updateURLWithSearch(term);
                searchManager.performSearch(term);
                searchInput.focus();
             }
             return;
        }

        if (!resultsContainer.contains(target) && target !== searchInput) {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.remove('has-results');
            document.querySelector('.search-container').classList.remove('has-results');
            selectedResultIndex = -1;
            isKeyboardActive = false;
            document.body.classList.remove('keyboard-active');
            randomTermsDisplayed = false; // Reset flag when clicking outside
        }
    });

    // Add mouse handlers for result items
    document.addEventListener('mouseover', (e) => {
        if (e.target.closest('.result-item') && isKeyboardActive) {
            isKeyboardActive = false;
            document.body.classList.remove('keyboard-active');
            
            // Update selection based on mouse position
            const resultItems = resultsContainer.querySelectorAll('.result-item');
            const hoveredItem = e.target.closest('.result-item');
            selectedResultIndex = Array.from(resultItems).indexOf(hoveredItem);
        }
    });
}

function handleStateChange(state) {
    if (!state.isInitialized) {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.remove('has-results');
        searchInput.placeholder = 'Initializing...';
    } else {
        searchInput.placeholder = state.mode === 'documentation' ? 'Search permaweb documentation' : 'Search permaweb glossary';
    }

            if (state.currentResults && (state.currentResults.length > 0 || searchInput.value)) {
            displayResults(state.currentResults, searchInput.value, state.mode);
            // Reset keyboard navigation after displaying results
            selectedResultIndex = -1; // Start with no selection until user presses arrow key
        } else {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.remove('has-results');
            document.querySelector('.search-container').classList.remove('has-results');
            selectedResultIndex = -1;
            
            // Reset random terms display flag when search is cleared
            if (!searchInput.value) {
                randomTermsDisplayed = false;
            }
            
            updateRandomTermsIfNeeded(state.mode);
        }
    
    clickableTitle.textContent = state.mode === 'documentation' ? 'Documentation' : 'Glossary';
    // Placeholder is set above based on initialization state
        
    // Only sync URL if we're initialized and there's a clear mismatch
    // Don't sync during mode transitions to avoid conflicts
    if (state.isInitialized) {
        const urlMode = getModeFromURL();
        const expectedURLMode = state.mode === 'documentation' ? 'docs' : 'glossary';
        
        // Only sync if there's a clear mismatch and we're not in a transition
        if (urlMode !== expectedURLMode && urlMode !== null) {
            syncURLWithCurrentState(state);
        }
    }
}

function syncURLWithCurrentState(state) {
    if (!state.isInitialized) return; // Don't sync during initialization
    
    const urlParams = new URLSearchParams(window.location.search);
    const currentURLMode = urlParams.get('mode');
    
    // Convert state mode to URL mode
    let expectedURLMode = null;
    if (state.mode === 'documentation') {
        expectedURLMode = 'docs';
    } else if (state.mode === 'glossary') {
        expectedURLMode = 'glossary';
    }
    
    // Only update URL if it doesn't match current state
    if (currentURLMode !== expectedURLMode) {
        if (expectedURLMode) {
            urlParams.set('mode', expectedURLMode);
        } else {
            urlParams.delete('mode');
        }
        
        const newUrl = urlParams.toString() 
            ? `${window.location.pathname}?${urlParams.toString()}`
            : window.location.pathname;
        
        // Update title based on current state
        const query = getSearchQueryFromURL();
        const modeText = state.mode === 'documentation' ? 'Documentation' : 'Glossary';
        document.title = query ? `${query} - Permaweb ${modeText}` : `Permaweb ${modeText} Search`;
        
        window.history.replaceState({}, '', newUrl);
    }
}


// Keyboard navigation variables and functions
let selectedResultIndex = -1;
let isKeyboardActive = false;

function handleKeyboardNavigation(event) {
    const resultItems = resultsContainer.querySelectorAll('.result-item');
    
    if (resultItems.length === 0) {
        return;
    }

    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            isKeyboardActive = true;
            document.body.classList.add('keyboard-active');
            
            // If no selection, start with first item
            if (selectedResultIndex === -1) {
                selectedResultIndex = 0;
            } else {
                // Snake back to top when reaching the bottom
                selectedResultIndex = (selectedResultIndex + 1) % resultItems.length;
            }
            updateKeyboardSelection();
            break;
            
        case 'ArrowUp':
            event.preventDefault();
            isKeyboardActive = true;
            document.body.classList.add('keyboard-active');
            
            // If no selection, start with last item
            if (selectedResultIndex === -1) {
                selectedResultIndex = resultItems.length - 1;
            } else {
                // Snake to bottom when reaching the top
                selectedResultIndex = selectedResultIndex === 0 ? resultItems.length - 1 : selectedResultIndex - 1;
            }
            updateKeyboardSelection();
            break;
            
        case 'Enter':
            event.preventDefault();
            if (selectedResultIndex >= 0 && selectedResultIndex < resultItems.length) {
                const selectedItem = resultItems[selectedResultIndex];
                const docLink = selectedItem.querySelector('.docs-link a');
                if (docLink) {
                    window.open(docLink.href, '_blank', 'noopener,noreferrer');
                } else {
                    selectedItem.click();
                }
            }
            break;
            
        case 'Escape':
            resultsContainer.innerHTML = '';
            resultsContainer.classList.remove('has-results');
            document.querySelector('.search-container').classList.remove('has-results');
            selectedResultIndex = -1;
            isKeyboardActive = false;
            document.body.classList.remove('keyboard-active');
            randomTermsDisplayed = false; // Reset flag when clearing with Escape
            updateRandomTermsIfNeeded(searchManager?.state?.mode || 'glossary');
            break;
    }
}

function updateKeyboardSelection() {
    const resultItems = resultsContainer.querySelectorAll('.result-item');
    
    // Remove selection from all items
    resultItems.forEach(item => item.classList.remove('selected'));
    
    // Add selection to current item
    if (selectedResultIndex >= 0 && selectedResultIndex < resultItems.length) {
        const selectedItem = resultItems[selectedResultIndex];
        selectedItem.classList.add('selected');
        selectedItem.scrollIntoView({
            behavior: 'auto',
            block: 'nearest'
        });
    }
}

function updateLoadingStatus(message, isError = false) {
    if (!loadingStatus) return;
    loadingStatus.textContent = message;
    loadingStatus.style.display = message ? 'block' : 'none';
    loadingStatus.classList.toggle('error', isError);
}

function showTemporaryError(message, duration = 3000) {
    // Create temporary error element
    const errorElement = document.createElement('div');
    errorElement.className = 'temporary-error';
    errorElement.textContent = message;
    errorElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        font-size: 14px;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(errorElement);
    
    // Remove after duration
    setTimeout(() => {
        errorElement.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (errorElement.parentNode) {
                errorElement.parentNode.removeChild(errorElement);
            }
        }, 300);
    }, duration);
}

// --- All UI rendering functions will live below ---
// --- They are driven by state changes, not direct calls from business logic ---

function displayResults(results, query, mode) {
    resultsContainer.innerHTML = '';

    if (!results || results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <p>No matching terms found for "${query}".</p>
                <p>Try a different search term or check your spelling.</p>
            </div>
        `;
        resultsContainer.classList.add('has-results');
        document.querySelector('.search-container').classList.add('has-results');
        return;
    }
    
    if (mode === 'documentation') {
        displayDocumentationResults(results, query);
    } else {
        displayGlossaryResults(results, query);
    }
}

function displayGlossaryResults(results, query) {
    const resultsList = document.createElement('div');
    resultsList.className = 'results-list';
    
    results.forEach((result, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        resultItem.setAttribute('data-index', index);
        
        const shareButton = createShareButton(result.term);
        resultItem.appendChild(shareButton);
        
        const termElement = document.createElement('div');
        termElement.className = 'term';
        termElement.textContent = result.term;
        
        const categoryElement = document.createElement('div');
        categoryElement.className = 'category';
        categoryElement.textContent = result.category;
        
        const definitionElement = document.createElement('div');
        definitionElement.className = 'definition';
        definitionElement.innerHTML = makeTermsClickable(result.definition, glossaryDataForUI);
        
        const numberElement = document.createElement('div');
        numberElement.className = 'result-number';
        numberElement.textContent = index + 1;
        resultItem.appendChild(numberElement);

        resultItem.appendChild(termElement);
        resultItem.appendChild(categoryElement);
        resultItem.appendChild(definitionElement);

        if (result.aliases && result.aliases.length > 0) {
            const aliasesElement = document.createElement('div');
            aliasesElement.className = 'aliases';
            aliasesElement.innerHTML = `<strong>Also known as:</strong> ${result.aliases.join(', ')}`;
            resultItem.appendChild(aliasesElement);
        }
        
        if (result.related && result.related.length > 0) {
            const relatedElement = document.createElement('div');
            relatedElement.className = 'related-terms';
            result.related.forEach(relatedTerm => {
                const relatedTag = document.createElement('span');
                relatedTag.className = 'related-tag';
                relatedTag.textContent = relatedTerm;
                relatedTag.setAttribute('data-term', relatedTerm);
                relatedElement.appendChild(relatedTag);
            });
            resultItem.appendChild(relatedElement);
        }
        
        if (result.docs && result.docs.length > 0) {
            const docsElement = document.createElement('div');
            docsElement.className = 'docs-link';
            docsElement.innerHTML = `<a href="${result.docs[0]}" target="_blank" rel="noopener noreferrer">Learn more →</a>`;
            resultItem.appendChild(docsElement);
        }
        
        resultsList.appendChild(resultItem);
    });
    
    resultsContainer.appendChild(resultsList);
    resultsContainer.classList.add('has-results');
    document.querySelector('.search-container').classList.add('has-results');
}

function displayDocumentationResults(results, query) {
    // Deduplicate by URL
    const seenUrls = new Set();
    const dedupedResults = results.filter(result => {
        if (!result.url) return true;
        if (seenUrls.has(result.url)) return false;
        seenUrls.add(result.url);
        return true;
    });

    resultsContainer.innerHTML = dedupedResults.map((result, index) => 
        createDocumentationResultHTML(result, query, index)
    ).join('');
    
    // Add click handlers for documentation results
    resultsContainer.querySelectorAll('.result-item[data-url]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = item.getAttribute('data-url');
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        });
    });
    resultsContainer.classList.add('has-results');
    document.querySelector('.search-container').classList.add('has-results');
}

function createDocumentationResultHTML(result, query, index) {
    const breadcrumbs = result.breadcrumbs?.join(' › ') || result.siteName;
    const lastModified = result.lastModified 
        ? new Date(result.lastModified).toLocaleDateString()
        : '';
    
    const estimatedReadTime = result.estimatedWords 
        ? `${Math.ceil(result.estimatedWords / 200)} min read`
        : '';
        
    const metaInfo = [
        breadcrumbs,
        estimatedReadTime,
        lastModified ? `Updated ${lastModified}` : ''
    ].filter(Boolean).join(' • ');

    // Use the source URL as the label (hostname as plain text)
    const sourceUrl = result.url;
    const sourceHost = new URL(sourceUrl).hostname;
    const sourceLabel = sourceHost;

    return `
        <div class="result-item" data-url="${sourceUrl}" tabindex="0" aria-label="Open ${result.title}">
            <div class="term">${highlightQuery(result.title, query)}</div>
            <div class="category">${sourceLabel}</div>
            <div class="definition">${highlightQuery(result.snippet, query)}</div>
            ${metaInfo ? `<div class="aliases"><strong>Source:</strong> ${metaInfo}</div>` : ''}
            <div class="docs-link">
                <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">View page →</a>
            </div>
            <div class="result-number">${index + 1}</div>
        </div>
    `;
}

function highlightQuery(text, query) {
    if (!query || !query.trim()) return text;
    const words = query.trim().split(/\s+/);
    let highlightedText = text;
    words.forEach(word => {
        const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<span class="highlight">$1</span>');
    });
    return highlightedText;
}

function makeTermsClickable(definition, allTerms) {
    if (!allTerms) return definition;
    const termMap = new Map();
    const aliasMap = new Map();
    const primaryTerms = new Set();
    
    allTerms.forEach(term => {
        primaryTerms.add(term.term.toLowerCase());
        termMap.set(term.term.toLowerCase(), term.term);
        const pluralForm = term.term + 's';
        termMap.set(pluralForm.toLowerCase(), term.term);
        aliasMap.set(pluralForm.toLowerCase(), { originalTerm: term.term, isHidden: true });
    });
    
    allTerms.forEach(term => {
        if (term.aliases) {
            term.aliases.forEach(alias => {
                const aliasLower = alias.toLowerCase();
                if (!primaryTerms.has(aliasLower)) {
                    termMap.set(aliasLower, term.term);
                    aliasMap.set(aliasLower, { originalTerm: term.term, isHidden: false });
                    const plural = alias + 's';
                    if (!primaryTerms.has(plural.toLowerCase())) {
                        termMap.set(plural.toLowerCase(), term.term);
                        aliasMap.set(plural.toLowerCase(), { originalTerm: term.term, isHidden: true });
                    }
                }
            });
        }
    });

    const sortedTerms = Array.from(termMap.keys()).filter(t => t.length > 2).sort((a, b) => b.length - a.length);
    let tempHTML = definition;

    sortedTerms.forEach(termLower => {
        const originalTerm = termMap.get(termLower);
        const aliasInfo = aliasMap.get(termLower);
        const isHidden = aliasInfo ? aliasInfo.isHidden : false;
        const regex = new RegExp(`\\b(${termLower})\\b`, 'gi');
        tempHTML = tempHTML.replace(regex, (match) => {
             return `<span class="clickable-term" data-term="${originalTerm}" data-is-hidden-alias="${isHidden}">${match}</span>`;
        });
    });

    return tempHTML;
}

function createShareButton(term) {
    const button = document.createElement('button');
    button.className = 'share-button';
    button.setAttribute('aria-label', 'Share term');
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>`;
    button.addEventListener('click', async (e) => {
        e.stopPropagation();
        const url = new URL(window.location.href);
        url.searchParams.set('q', term);
        
        // Include current mode in shared URL
        if (searchManager?.state?.isInitialized) {
            const currentMode = searchManager.state.mode;
            if (currentMode === 'documentation') {
                url.searchParams.set('mode', 'docs');
            } else if (currentMode === 'glossary') {
                url.searchParams.set('mode', 'glossary');
            }
        }
        
        try {
            await navigator.clipboard.writeText(url.toString());
            button.classList.add('copied');
            setTimeout(() => { button.classList.remove('copied'); }, 1000);
        } catch (err) {
            console.error('Failed to copy URL:', err);
        }
    });
    return button;
}

function updateRandomTermsIfNeeded(mode = 'glossary') {
    // Update random terms if:
    // 1. Mode has changed, OR
    // 2. We're in glossary mode, have data, and haven't displayed terms yet
    const shouldUpdate = currentRandomTermsMode !== mode || 
                        (mode === 'glossary' && glossaryDataForUI && !randomTermsDisplayed);
    
    if (shouldUpdate) {
        currentRandomTermsMode = mode;
        // Only create random terms if we have data or it's documentation mode
        if (mode === 'documentation' || glossaryDataForUI) {
            createRandomTermTags(mode);
            randomTermsDisplayed = true;
        }
    }
}

function createRandomTermTags(mode = 'glossary') {
    let container = document.querySelector('.random-terms-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'random-terms-container';
        // Insert after the search-input div, not inside it
        const searchInputDiv = searchInput.parentNode;
        if (searchInputDiv) {
            searchInputDiv.parentNode.insertBefore(container, searchInputDiv.nextSibling);
        } else {
            console.error('searchInput.parentNode is null, cannot insert random terms container');
            return;
        }
    }

    const termsContainer = document.createElement('div');
    termsContainer.className = 'related-terms random-terms';
    
    if (mode === 'documentation') {
        // Show 3 random documentation pages
        const docPages = [
            { name: 'Getting Started', description: 'Arweave basics' },
            { name: 'Processes', description: 'AO compute processes' },
            { name: 'Gateway Setup', description: 'AR.IO gateway configuration' },
            { name: 'Data Storage', description: 'Permanent data storage' },
            { name: 'AO Processes', description: 'AO smart contract development' },
            { name: 'Wallet Integration', description: 'Connecting wallets' },
            { name: 'File Upload', description: 'Uploading to Arweave' },
            { name: 'GraphQL API', description: 'Querying Arweave data' },
            { name: 'Tokens', description: 'AO token standards' },
            { name: 'Bundling', description: 'Data bundling concepts' },
            { name: 'Gateways', description: 'AR.IO gateway network' }
        ];
        
        const shuffled = [...docPages].sort(() => 0.5 - Math.random());
        const pagesToShow = shuffled.slice(0, 3);

        pagesToShow.forEach(page => {
            const tag = document.createElement('span');
            tag.className = 'related-tag doc-page-tag';
            tag.textContent = page.name;
            tag.setAttribute('data-doc-page', page.name.toLowerCase());
            tag.setAttribute('title', page.description);
            tag.style.cursor = 'pointer';
            tag.addEventListener('click', () => {
                searchInput.value = page.name;
                searchManager.performSearch(page.name);
                searchInput.focus();
            });
            termsContainer.appendChild(tag);
        });
    } else {
        // Show random glossary terms (original behavior)
        if (!glossaryDataForUI) {
            return;
        }
        
        const shuffled = [...glossaryDataForUI].sort(() => 0.5 - Math.random());
        const termsToShow = shuffled.slice(0, NUM_RANDOM_TAGS);

        termsToShow.forEach(term => {
            const tag = document.createElement('span');
            tag.className = 'related-tag';
            tag.textContent = term.term;
            tag.setAttribute('data-term', term.term);
            termsContainer.appendChild(tag);
        });
    }
    
    container.innerHTML = '';
    container.appendChild(termsContainer);
    
}

// --- Theme & UI Param Functions ---

function getSearchQueryFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('q');
}

function getModeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    // Convert URL mode values to internal mode values
    if (mode === 'docs') {
        return 'documentation';
    } else if (mode === 'glossary') {
        return 'glossary';
    }
    return null; // No mode specified, will use default
}

function updateURLWithSearch(query) {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Update or remove query parameter
    if (query) {
        urlParams.set('q', query);
    } else {
        urlParams.delete('q');
    }
    
    // Ensure mode parameter matches current application state
    if (searchManager?.state?.isInitialized) {
        const currentMode = searchManager.state.mode;
        if (currentMode === 'documentation') {
            urlParams.set('mode', 'docs');
        } else if (currentMode === 'glossary') {
            urlParams.set('mode', 'glossary');
        }
    }
    
    const newUrl = urlParams.toString() 
        ? `${window.location.pathname}?${urlParams.toString()}`
        : window.location.pathname;
    
    // Update title based on current state
    const currentMode = searchManager?.state?.mode || 'glossary';
    const modeText = currentMode === 'documentation' ? 'Documentation' : 'Glossary';
    document.title = query ? `${query} - Permaweb ${modeText}` : `Permaweb ${modeText} Search`;
    window.history.pushState({}, '', newUrl);
}

function updateURLWithMode(mode) {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Convert internal mode values to URL-friendly values
    if (mode === 'documentation') {
        urlParams.set('mode', 'docs');
    } else if (mode === 'glossary') {
        urlParams.set('mode', 'glossary');
    } else {
        urlParams.delete('mode');
    }
    
    const newUrl = urlParams.toString() 
        ? `${window.location.pathname}?${urlParams.toString()}`
        : window.location.pathname;
    
    // Update title based on new mode
    const query = getSearchQueryFromURL();
    const modeText = mode === 'documentation' ? 'Documentation' : 'Glossary';
    document.title = query ? `${query} - Permaweb ${modeText}` : `Permaweb ${modeText} Search`;
    
    window.history.pushState({}, '', newUrl);
}

function isIframeEmbed() {
    return window.self !== window.top;
}

function applyQueryParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // ===== UI VISIBILITY PARAMETERS =====
    const hideHeader = urlParams.get('hide-header');
    if (hideHeader === 'true' || hideHeader === '1') {
        document.documentElement.classList.add('hide-header');
    }
    
    // Random terms should always be centered
    window.randomTermsJustification = 'center';
    
    const hideRecommendations = urlParams.get('hide-recommendations');
    if (hideRecommendations === 'true' || hideRecommendations === '1') {
        document.documentElement.classList.add('hide-recommendations');
    }
    
    // Handle translucent background parameter
    const translucent = urlParams.get('translucent');
    if (translucent) {
        document.documentElement.classList.add('translucent-bg');
        
        // Apply custom opacity if numeric value is provided
        const opacity = parseFloat(translucent);
        if (!isNaN(opacity) && opacity >= 0 && opacity <= 1) {
            document.documentElement.style.setProperty('--translucent-opacity', opacity);
        }
    }
    
    // ===== SIMPLIFIED COLOR SYSTEM =====
    applyColorTheme(urlParams);
}

function applyColorTheme(urlParams) {
    const root = document.documentElement;
    
    // ===== BACKWARDS COMPATIBILITY DETECTION =====
    // Check if user is using the old detailed parameter system
    const oldSystemParams = [
        'input-bg', 'hover-bg', 'category-bg', 'category-text', 'link-color',
        'result-bg', 'result-hover', 'heading-color', 'tag-bg', 'tag-text',
        'button-bg', 'button-text', 'accent-color', 'secondary-text', 'border-color'
    ];
    
    const newSystemParams = ['theme-color', 'mode'];
    
    // Check if any old system specific params are provided
    const hasOldSystemParams = oldSystemParams.some(param => urlParams.get(param));
    const hasNewSystemParams = newSystemParams.some(param => urlParams.get(param));
    
    // Core parameters (can be used in both systems)
    const bgColor = urlParams.get('bg-color');
    const textColor = urlParams.get('text-color');
    const themeColor = urlParams.get('theme-color');
    const mode = urlParams.get('mode');
    
    // Skip if no theme parameters provided
    if (!themeColor && !bgColor && !textColor && !mode && !hasOldSystemParams) {
        return;
    }
    
    // Check if user has explicitly set a theme preference via toggle
    // If so, respect their choice and don't override with URL parameters
    const userThemePreference = localStorage.getItem('theme');
    if (userThemePreference && !urlParams.get('force-theme')) {
        console.log('User has theme preference, URL color parameters ignored. Use ?force-theme=1 to override.');
        return;
    }
    
    let derivedColors = {};
    
    // ===== BACKWARDS COMPATIBILITY: OLD SYSTEM =====
    if (hasOldSystemParams && !hasNewSystemParams) {
        // User is using old system - apply explicit mapping only
        
        // In old system, bg-color and text-color were explicit, not smart
        if (bgColor && isValidHexColor(bgColor)) {
            derivedColors['--ao-bg-color'] = bgColor;
            // Don't auto-derive other colors in old system
        }
        
        if (textColor && isValidHexColor(textColor)) {
            derivedColors['--ao-text-color'] = textColor;
            // Don't auto-derive other colors in old system
        }
        
        // Apply all old system specific parameters
        const oldSystemMapping = {
            'input-bg': '--ao-input-bg',
            'hover-bg': '--ao-hover-bg',
            'category-bg': '--ao-category-bg',
            'category-text': '--ao-category-text',
            'link-color': '--ao-link-color',
            'result-bg': '--ao-result-bg',
            'result-hover': '--ao-result-hover',
            'heading-color': '--ao-heading-color',
            'tag-bg': '--ao-tag-bg',
            'tag-text': '--ao-tag-text',
            'button-bg': '--ao-button-bg',
            'button-text': '--ao-button-text',
            'accent-color': '--ao-accent-color',
            'secondary-text': '--ao-secondary-text',
            'border-color': '--ao-border-color'
        };
        
        Object.entries(oldSystemMapping).forEach(([param, cssVar]) => {
            const value = urlParams.get(param);
            if (value && isValidHexColor(value)) {
                derivedColors[cssVar] = value;
            }
        });
    }
    
    // ===== NEW SYSTEM: SMART DERIVATION =====
    else if (hasNewSystemParams || (!hasOldSystemParams && (bgColor || textColor))) {
        // User is using new system or glossary bg/text colors - apply smart derivation
        
        // Determine base colors with smart defaults
        let baseBg = bgColor;
        let baseText = textColor;
        let baseTheme = themeColor;
        
        // Auto-detect mode if not specified
        if (!baseBg && !baseText && mode) {
            if (mode === 'dark') {
                baseBg = '#121212';
                baseText = '#e0e0e0';
                baseTheme = baseTheme || '#34d399';
            } else {
                baseBg = '#ffffff';
                baseText = '#000000';
                baseTheme = baseTheme || '#29a879';
            }
        }
        
        // Derive comprehensive color scheme from base colors
        if (baseBg && isValidHexColor(baseBg)) {
            derivedColors['--ao-bg-color'] = baseBg;
            derivedColors['--ao-input-bg'] = baseBg;
            derivedColors['--ao-result-bg'] = baseBg;
            derivedColors['--ao-hover-bg'] = adjustColorBrightness(baseBg, 0.03);
            derivedColors['--ao-result-hover'] = adjustColorBrightness(baseBg, 0.05);
            derivedColors['--ao-section-bg'] = adjustColorBrightness(baseBg, 0.02);
            derivedColors['--ao-border-color'] = adjustColorBrightness(baseBg, -0.9);
            derivedColors['--ao-category-bg'] = adjustColorBrightness(baseBg, -0.03);
            
            // Update translucent background if enabled
            if (urlParams.get('translucent')) {
                const rgb = hexToRgb(baseBg);
                const opacity = root.style.getPropertyValue('--translucent-opacity') || 0.92;
                derivedColors['--translucent-bg-color'] = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
            }
        }
        
        if (baseText && isValidHexColor(baseText)) {
            derivedColors['--ao-text-color'] = baseText;
            derivedColors['--ao-heading-color'] = baseText;
            derivedColors['--ao-section-color'] = baseText;
            derivedColors['--ao-secondary-text'] = addOpacity(baseText, 0.6);
            derivedColors['--ao-category-text'] = addOpacity(baseText, 0.7);
        }
        
        if (baseTheme && isValidHexColor(baseTheme)) {
            derivedColors['--ao-accent-color'] = baseTheme;
            derivedColors['--ao-link-color'] = baseTheme;
            derivedColors['--ao-focus-color'] = baseTheme;
            derivedColors['--ao-tag-bg'] = derivedColors['--ao-border-color'] || adjustColorBrightness(baseBg, -0.85);
            derivedColors['--ao-button-bg'] = baseTheme;
            
            // Auto-contrast for text on theme color
            const contrastText = getContrastColor(baseTheme);
            const borderColor = derivedColors['--ao-border-color'] || adjustColorBrightness(baseBg, -0.85);
            derivedColors['--ao-tag-text'] = getContrastColor(borderColor);
            derivedColors['--ao-button-text'] = contrastText;
            
            // Hover states
            derivedColors['--ao-button-hover-bg'] = adjustColorBrightness(baseTheme, -0.1);
            derivedColors['--ao-button-hover-border'] = adjustColorBrightness(baseTheme, -0.1);
        }
    }
    
    // ===== HYBRID SYSTEM: SPECIFIC OVERRIDES =====
    // Always allow specific parameter overrides to take precedence
    // This enables mixing old and new systems
    const specificOverrides = {
        'input-bg': '--ao-input-bg',
        'hover-bg': '--ao-hover-bg',
        'category-bg': '--ao-category-bg',
        'category-text': '--ao-category-text',
        'link-color': '--ao-link-color',
        'result-bg': '--ao-result-bg',
        'result-hover': '--ao-result-hover',
        'heading-color': '--ao-heading-color',
        'tag-bg': '--ao-tag-bg',
        'tag-text': '--ao-tag-text',
        'button-bg': '--ao-button-bg',
        'button-text': '--ao-button-text',
        'accent-color': '--ao-accent-color',
        'secondary-text': '--ao-secondary-text',
        'border-color': '--ao-border-color'
    };
    
    Object.entries(specificOverrides).forEach(([param, cssVar]) => {
        const value = urlParams.get(param);
        if (value && isValidHexColor(value)) {
            derivedColors[cssVar] = value; // This will override any smart-derived values
        }
    });
    
    // Apply all derived colors
    let colorsApplied = false;
    Object.entries(derivedColors).forEach(([cssVar, value]) => {
        if (value) {
            root.style.setProperty(cssVar, value);
            colorsApplied = true;
        }
    });
}

// ===== COLOR UTILITY FUNCTIONS =====

function isValidHexColor(hex) {
    return /^#([0-9A-F]{3}){1,2}$/i.test(hex);
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function adjustColorBrightness(hexColor, percent) {
    const rgb = hexToRgb(hexColor);
    if (!rgb) return hexColor;
    
    const { r, g, b } = rgb;
    const factor = percent > 0 ? 1 + percent : 1 + percent;
    
    const newR = Math.round(Math.min(255, Math.max(0, r * factor)));
    const newG = Math.round(Math.min(255, Math.max(0, g * factor)));
    const newB = Math.round(Math.min(255, Math.max(0, b * factor)));
    
    return rgbToHex(newR, newG, newB);
}

function addOpacity(hexColor, opacity) {
    const rgb = hexToRgb(hexColor);
    if (!rgb) return hexColor;
    
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

function getContrastColor(hexColor) {
    const rgb = hexToRgb(hexColor);
    if (!rgb) return '#000000';
    
    // Calculate luminance using WCAG formula
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    
    // Return white for dark colors, black for light colors
    return luminance > 0.5 ? '#000000' : '#ffffff';
}

function initializeTheme() {
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const storedTheme = localStorage.getItem('theme');
    const theme = storedTheme || (prefersDarkScheme.matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    
    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Clear URL-based color overrides when theme toggle is used
        clearUrlColorOverrides();
    });
}

function clearUrlColorOverrides() {
    const root = document.documentElement;
    
    // List of all CSS custom properties that might be set by URL parameters
    const colorProperties = [
        '--ao-bg-color', '--ao-text-color', '--ao-border-color', '--ao-input-bg',
        '--ao-hover-bg', '--ao-category-bg', '--ao-category-text', '--ao-link-color',
        '--ao-result-bg', '--ao-result-hover', '--ao-heading-color', '--ao-tag-bg',
        '--ao-tag-text', '--ao-button-bg', '--ao-button-text', '--ao-accent-color',
        '--ao-secondary-text', '--ao-section-bg', '--ao-section-color',
        '--ao-button-hover-bg', '--ao-button-hover-border', '--ao-focus-color',
        '--translucent-bg-color'
    ];
    
    // Remove all URL-based color overrides
    colorProperties.forEach(property => {
        root.style.removeProperty(property);
    });
    
    // Also remove translucent background class if it was set by URL
    if (document.documentElement.classList.contains('translucent-bg')) {
        document.documentElement.classList.remove('translucent-bg');
    }
} 
