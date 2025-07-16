import { SearchManager } from './search-manager.js';
import { BasicSearchProvider } from './basic-search-provider.js';
import { EnhancedSearchProvider } from './enhanced-search-provider.js';

// --- Constants ---
const DEBUG = false;
const NUM_RANDOM_TAGS = 8;

// --- Service Worker ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => { if (DEBUG) console.log('SW registered'); })
            .catch(err => { if (DEBUG) console.log('SW registration failed: ', err); });
    });
}

// --- DOM Elements ---
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('results');
const loadingStatus = document.getElementById('loading-status');
const clickableTitle = document.getElementById('clickableTitle');
const themeToggle = document.querySelector('.theme-toggle');

// --- State ---
let searchManager;
let glossaryDataForUI = null; // To help with rendering clickable terms

// --- Initialization ---
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        updateLoadingStatus('Initializing application...');

        applyQueryParameters();
        initializeTheme();

        if (isIframeEmbed()) {
            document.documentElement.classList.add('iframe-embed');
        }

        searchManager = new SearchManager();
        
        const basicProvider = new BasicSearchProvider();
        searchManager.registerProvider('basic', basicProvider);

        const enhancedProvider = new EnhancedSearchProvider();
        searchManager.registerProvider('enhanced', enhancedProvider);
        
        searchManager.state.subscribe(handleStateChange);
        
        // Get initial mode from URL parameter
        const initialMode = getModeFromURL() || 'basic';
        await searchManager.initialize(initialMode);
        
        // Expose searchManager globally for JSON API access
        window.searchManager = searchManager;
        
        // Expose glossary data for UI functions
        glossaryDataForUI = basicProvider.glossaryData;

        initializeUIHandlers();

        const initialQuery = getSearchQueryFromURL();
        if (initialQuery) {
            searchInput.value = initialQuery;
            searchManager.performSearch(initialQuery);
        } else {
            createRandomTermTags();
        }

        if (!isIframeEmbed()) {
            searchInput.focus();
        }
        updateLoadingStatus('');

        // Add browser navigation support
        setupBrowserNavigation();

    } catch (error) {
        console.error('Initialization error:', error);
        updateLoadingStatus('Failed to load application.', true);
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
                createRandomTermTags();
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
        const newMode = currentMode === 'basic' ? 'enhanced' : 'basic';
        if (searchManager.searchProviders.has(newMode)) {
            searchManager.switchMode(newMode).then(() => {
                // Instantly update results after mode switch
                const query = searchInput.value;
                if (query) {
                    searchManager.performSearch(query);
                } else {
                    // If input is empty, clear results and show random tags
                    resultsContainer.innerHTML = '';
                    resultsContainer.classList.remove('has-results');
                    document.querySelector('.search-container').classList.remove('has-results');
                    createRandomTermTags();
                }
                
                // Auto-refocus the search input after mode toggle
                if (!isIframeEmbed()) {
                    searchInput.focus();
                }
                updateURLWithMode(newMode);
            });
        } else {
            console.warn(`Provider for mode "${newMode}" not available yet.`);
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
        updateLoadingStatus('Initializing...');
        resultsContainer.innerHTML = '';
        resultsContainer.classList.remove('has-results');
    } else {
        updateLoadingStatus('');
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
        createRandomTermTags();
    }
    
    clickableTitle.textContent = state.mode === 'enhanced' ? 'Documentation' : 'Glossary';
    searchInput.placeholder = state.mode === 'enhanced' 
        ? 'Search Permaweb documentation...'
        : 'Search glossary terms...';
        
    // Check for fallback before syncing URL (so we can detect the mismatch)
    const urlMode = getModeFromURL();
    const hadFallback = urlMode === 'enhanced' && state.mode === 'basic' && state.isInitialized;
    
    // Always sync URL with actual state mode
    syncURLWithCurrentState(state);
        
    // Show notification if enhanced mode was requested but fell back to basic
    if (hadFallback) {
        showModeUnavailableNotification();
    }
}

function syncURLWithCurrentState(state) {
    if (!state.isInitialized) return; // Don't sync during initialization
    
    const urlParams = new URLSearchParams(window.location.search);
    const currentURLMode = urlParams.get('mode');
    
    // Convert state mode to URL mode
    let expectedURLMode = null;
    if (state.mode === 'enhanced') {
        expectedURLMode = 'docs';
    } else if (state.mode === 'basic') {
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
        const modeText = state.mode === 'enhanced' ? 'Documentation' : 'Glossary';
        document.title = query ? `${query} - Permaweb ${modeText}` : `Permaweb ${modeText} Search`;
        
        window.history.replaceState({}, '', newUrl);
    }
}

function showModeUnavailableNotification() {
    // Only show once per session
    if (window.docsUnavailableNotificationShown) return;
    window.docsUnavailableNotificationShown = true;
    
    const notification = document.createElement('div');
    notification.className = 'mode-notification';
    notification.innerHTML = `
        <p>📚 Documentation search is temporarily unavailable. Showing glossary results instead.</p>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
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
                selectedResultIndex = Math.min(selectedResultIndex + 1, resultItems.length - 1);
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
                selectedResultIndex = Math.max(selectedResultIndex - 1, 0);
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
            createRandomTermTags();
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
            behavior: 'smooth',
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
    
    if (mode === 'enhanced') {
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
    resultsContainer.innerHTML = results.map(result => 
        createDocumentationResultHTML(result, query)
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

function createDocumentationResultHTML(result, query) {
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
            if (currentMode === 'enhanced') {
                url.searchParams.set('mode', 'docs');
            } else if (currentMode === 'basic') {
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

function createRandomTermTags() {
    if (!glossaryDataForUI) return;
    let container = document.querySelector('.random-terms-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'random-terms-container';
        // Insert after the search-input div, not inside it
        const searchInputDiv = searchInput.parentNode;
        searchInputDiv.parentNode.insertBefore(container, searchInputDiv.nextSibling);
    }

    const termsContainer = document.createElement('div');
    termsContainer.className = 'related-terms random-terms';
    
    const shuffled = [...glossaryDataForUI].sort(() => 0.5 - Math.random());
    const termsToShow = shuffled.slice(0, NUM_RANDOM_TAGS);

    termsToShow.forEach(term => {
        const tag = document.createElement('span');
        tag.className = 'related-tag';
        tag.textContent = term.term;
        tag.setAttribute('data-term', term.term);
        termsContainer.appendChild(tag);
    });
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
    if (mode === 'docs' || mode === 'documentation') {
        return 'enhanced';
    } else if (mode === 'glossary') {
        return 'basic';
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
        if (currentMode === 'enhanced') {
            urlParams.set('mode', 'docs');
        } else if (currentMode === 'basic') {
            urlParams.set('mode', 'glossary');
        }
    }
    
    const newUrl = urlParams.toString() 
        ? `${window.location.pathname}?${urlParams.toString()}`
        : window.location.pathname;
    
    // Update title based on current state
    const currentMode = searchManager?.state?.mode || 'basic';
    const modeText = currentMode === 'enhanced' ? 'Documentation' : 'Glossary';
    document.title = query ? `${query} - Permaweb ${modeText}` : `Permaweb ${modeText} Search`;
    window.history.pushState({}, '', newUrl);
}

function updateURLWithMode(mode) {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Convert internal mode values to URL-friendly values
    if (mode === 'enhanced') {
        urlParams.set('mode', 'docs');
    } else if (mode === 'basic') {
        urlParams.set('mode', 'glossary');
    } else {
        urlParams.delete('mode');
    }
    
    const newUrl = urlParams.toString() 
        ? `${window.location.pathname}?${urlParams.toString()}`
        : window.location.pathname;
    
    // Update title based on new mode
    const query = getSearchQueryFromURL();
    const modeText = mode === 'enhanced' ? 'Documentation' : 'Glossary';
    document.title = query ? `${query} - Permaweb ${modeText}` : `Permaweb ${modeText} Search`;
    
    window.history.pushState({}, '', newUrl);
}

function isIframeEmbed() {
    return window.self !== window.top;
}

function applyQueryParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    if (DEBUG) console.log('URL search params:', window.location.search);
    
    const hideHeader = urlParams.get('hide-header');
    if (hideHeader === 'true' || hideHeader === '1') {
        document.documentElement.classList.add('hide-header');
        window.randomTermsJustification = 'center';
    } else {
        window.randomTermsJustification = 'flex-start';
    }
    
    if (urlParams.get('hide-recommendations') === 'true' || urlParams.get('hide-recommendations') === '1') {
        document.documentElement.classList.add('hide-recommendations');
    }
    
    // ... rest of the param handling ...
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
    });
} 
