// Keyboard navigation for search results
let selectedResultIndex = 0; // Start with first result selected
let isTxResult = false; // Track if the current result is a transaction
let isKeyboardActive = false; // Flag to track if the keyboard is active
let isIframeMode = false; // Track if we're in iframe mode

// Initialize keyboard navigation
function initKeyboardNavigation() {
    // Check if we're in iframe mode
    isIframeMode = window.self !== window.top;
    
    // Add keyboard navigation event listener to search input
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('keydown', handleKeyNavigation);
    
    // Add input event listener to detect typing
    searchInput.addEventListener('input', () => {
        isKeyboardActive = true;
        document.body.classList.add('keyboard-active');
    });
}

// Handle keyboard navigation
function handleKeyNavigation(event) {
    const resultsContainer = document.getElementById('results');
    
    // Only process if we have results
    if (!resultsContainer.classList.contains('has-results')) {
        return;
    }
    
    // Check if we're dealing with transaction results
    isTxResult = resultsContainer.querySelector('.tx-result') !== null;
    
    // Get the appropriate result items based on type and mode
    let resultItems;
    if (isIframeMode) {
        // In iframe mode, we handle result-display elements
        resultItems = resultsContainer.querySelectorAll('.result-display');
    } else {
        // In regular mode, we handle result-item or tx-result elements
        resultItems = isTxResult 
            ? resultsContainer.querySelectorAll('.tx-result')
            : resultsContainer.querySelectorAll('.result-item');
    }
    
    const resultCount = resultItems.length;
    
    // If no results, exit
    if (resultCount === 0) {
        return;
    }
    
    switch (event.key) {
        case 'ArrowDown':
        case 'ArrowRight':
            event.preventDefault(); // Prevent scrolling the page
            isKeyboardActive = true;
            document.body.classList.add('keyboard-active');
            selectedResultIndex = (selectedResultIndex + 1) % resultCount;
            updateSelectedResult(resultItems);
            if (isIframeMode) {
                navigateIframeResults(selectedResultIndex);
            }
            break;
            
        case 'ArrowUp':
        case 'ArrowLeft':
            event.preventDefault(); // Prevent scrolling the page
            isKeyboardActive = true;
            document.body.classList.add('keyboard-active');
            selectedResultIndex = (selectedResultIndex - 1 + resultCount) % resultCount;
            updateSelectedResult(resultItems);
            if (isIframeMode) {
                navigateIframeResults(selectedResultIndex);
            }
            break;
            
        case 'Enter':
            event.preventDefault(); // Prevent form submission
            if (selectedResultIndex >= 0 && selectedResultIndex < resultCount) {
                // Get the selected result
                const selectedResult = resultItems[selectedResultIndex];
                
                if (isTxResult) {
                    // For transaction results, open on ViewBlock
                    const txId = selectedResult.querySelector('.term').textContent.trim();
                    window.open(`https://viewblock.io/arweave/tx/${txId}`, '_blank', 'noopener,noreferrer');
                } else if (isIframeMode) {
                    // For iframe mode, find and click the "Learn more" link if available
                    const docLink = selectedResult.querySelector('.docs-link a');
                    if (docLink) {
                        window.open(docLink.href, '_blank', 'noopener,noreferrer');
                    }
                } else {
                    // For regular results in standard mode
                    const resultIndex = parseInt(selectedResult.getAttribute('data-index'));
                    
                    // Find the documentation link in the selected result
                    const docLink = selectedResult.querySelector('.docs-link a');
                    if (docLink) {
                        // Navigate to the documentation link
                        window.open(docLink.href, '_blank', 'noopener,noreferrer');
                    } else {
                        // If no documentation link, just trigger click on the selected item
                        selectedResult.click();
                    }
                }
            } else if (resultCount > 0) {
                // If no item is selected but we have results, select the first one
                selectedResultIndex = 0;
                updateSelectedResult(resultItems);
                
                if (isTxResult) {
                    // For transaction results, open on ViewBlock
                    const txId = resultItems[0].querySelector('.term').textContent.trim();
                    window.open(`https://viewblock.io/arweave/tx/${txId}`, '_blank', 'noopener,noreferrer');
                } else if (isIframeMode) {
                    // For iframe mode, find and click the "Learn more" link if available
                    const docLink = resultItems[0].querySelector('.docs-link a');
                    if (docLink) {
                        window.open(docLink.href, '_blank', 'noopener,noreferrer');
                    }
                    navigateIframeResults(0);
                } else {
                    // For regular results, handle as before
                    const firstResult = resultItems[0];
                    const docLink = firstResult.querySelector('.docs-link a');
                    if (docLink) {
                        window.open(docLink.href, '_blank', 'noopener,noreferrer');
                    } else {
                        firstResult.click();
                    }
                }
            }
            break;
            
        case 'Escape':
            // Clear results and reset
            resultsContainer.innerHTML = '';
            resultsContainer.classList.remove('has-results');
            document.querySelector('.search-container').classList.remove('has-results');
            selectedResultIndex = -1;
            isKeyboardActive = false;
            document.body.classList.remove('keyboard-active');
            break;
    }
}

// Update the selected result with visual indicator
function updateSelectedResult(resultItems) {
    // Remove selected class from all items
    resultItems.forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selected class to the current item
    if (selectedResultIndex >= 0 && selectedResultIndex < resultItems.length) {
        resultItems[selectedResultIndex].classList.add('selected');
        
        // Ensure the selected item is visible at the top of the viewport
        setTimeout(() => {
            resultItems[selectedResultIndex].scrollIntoView({
                behavior: 'auto',
                block: 'start'
            });
        }, 0);
    }
}

// Navigate between iframe results
function navigateIframeResults(index) {
    const resultsContainer = document.getElementById('results');
    const resultDisplays = resultsContainer.querySelectorAll('.result-display');
    
    // Hide all displays
    resultDisplays.forEach(display => {
        display.classList.remove('active');
    });
    
    // Show the selected display
    if (index >= 0 && index < resultDisplays.length) {
        resultDisplays[index].classList.add('active');
        
        // Update navigation buttons
        const prevButtons = resultsContainer.querySelectorAll('.nav-button.prev');
        const nextButtons = resultsContainer.querySelectorAll('.nav-button.next');
        
        prevButtons.forEach(button => {
            button.disabled = index === 0;
        });
        
        nextButtons.forEach(button => {
            button.disabled = index === resultDisplays.length - 1;
        });
    }
}

// Reset selection when displaying new results
function resetSelection() {
    // Always select first result
    selectedResultIndex = 0;
    
    // Check if we're in iframe mode
    isIframeMode = window.self !== window.top;
    
    // Check if we're dealing with transaction results
    const resultsContainer = document.getElementById('results');
    isTxResult = resultsContainer.querySelector('.tx-result') !== null;
    
    // Get the appropriate result items based on type and mode
    let resultItems;
    if (isIframeMode) {
        resultItems = resultsContainer.querySelectorAll('.result-display');
    } else {
        resultItems = isTxResult 
            ? resultsContainer.querySelectorAll('.tx-result')
            : resultsContainer.querySelectorAll('.result-item');
    }
    
    // Always apply selection to first result if there are results
    if (resultItems.length > 0) {
        // Force a reflow to ensure DOM is updated
        resultsContainer.offsetHeight;
        
        // Set keyboard active state
        isKeyboardActive = true;
        document.body.classList.add('keyboard-active');
        
        // Update selection with a slight delay to ensure DOM is ready
        setTimeout(() => {
            updateSelectedResult(resultItems);
            if (isIframeMode) {
                navigateIframeResults(0);
            }
        }, 0);
    }
}

// Add minimal mouse handlers to result items
function addMouseHandlers() {
    // Check if we're in iframe mode
    isIframeMode = window.self !== window.top;
    
    // Check if we're dealing with transaction results
    const resultsContainer = document.getElementById('results');
    isTxResult = resultsContainer.querySelector('.tx-result') !== null;
    
    // Get the appropriate result items based on type and mode
    let resultItems;
    if (isIframeMode) {
        resultItems = resultsContainer.querySelectorAll('.result-display');
    } else {
        resultItems = isTxResult 
            ? resultsContainer.querySelectorAll('.tx-result')
            : resultsContainer.querySelectorAll('.result-item');
    }
    
    resultItems.forEach((item, index) => {
        // Only update selection on click, not hover
        item.addEventListener('mousedown', () => {
            if (isKeyboardActive) {
                isKeyboardActive = false;
                document.body.classList.remove('keyboard-active');
            }
            selectedResultIndex = index;
            updateSelectedResult(resultItems);
            if (isIframeMode) {
                navigateIframeResults(index);
            }
        });
        
        // For transaction results, add double-click to open on ViewBlock
        if (isTxResult) {
            item.addEventListener('dblclick', () => {
                const txId = item.querySelector('.term').textContent.trim();
                window.open(`https://viewblock.io/arweave/tx/${txId}`, '_blank', 'noopener,noreferrer');
            });
        }
    });
}

// Create the keyboard navigation object
const keyboardNav = {
    init: initKeyboardNavigation,
    reset: resetSelection,
    addMouseHandlers: addMouseHandlers
};

// Support both global export and module export
if (typeof window !== 'undefined') {
    window.keyboardNav = keyboardNav;
}

// Support ES modules
export { keyboardNav }; 