// Keyboard navigation for search results
let selectedResultIndex = -1; // Track the currently selected result
let isKeyboardActive = false; // Track if keyboard navigation is active

// Initialize keyboard navigation
function initKeyboardNavigation() {
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
    
    const resultItems = resultsContainer.querySelectorAll('.result-item');
    const resultCount = resultItems.length;
    
    // If no results, exit
    if (resultCount === 0) {
        return;
    }
    
    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault(); // Prevent scrolling the page
            isKeyboardActive = true;
            document.body.classList.add('keyboard-active');
            selectedResultIndex = (selectedResultIndex + 1) % resultCount;
            updateSelectedResult(resultItems);
            break;
            
        case 'ArrowUp':
            event.preventDefault(); // Prevent scrolling the page
            isKeyboardActive = true;
            document.body.classList.add('keyboard-active');
            selectedResultIndex = (selectedResultIndex - 1 + resultCount) % resultCount;
            updateSelectedResult(resultItems);
            break;
            
        case 'Enter':
            event.preventDefault(); // Prevent form submission
            if (selectedResultIndex >= 0 && selectedResultIndex < resultCount) {
                // Get the selected result
                const selectedResult = resultItems[selectedResultIndex];
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
            } else if (resultCount > 0) {
                // If no item is selected but we have results, select the first one and navigate to its doc link
                const firstResult = resultItems[0];
                const docLink = firstResult.querySelector('.docs-link a');
                if (docLink) {
                    window.open(docLink.href, '_blank', 'noopener,noreferrer');
                } else {
                    firstResult.click();
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
        
        // Ensure the selected item is visible (scroll into view if needed)
        resultItems[selectedResultIndex].scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }
}

// Reset selection when displaying new results
function resetSelection() {
    // Auto-select first result when keyboard is active
    selectedResultIndex = isKeyboardActive ? 0 : -1;
    
    // Apply the selection to the first result if keyboard is active
    const resultItems = document.querySelectorAll('.result-item');
    if (resultItems.length > 0 && isKeyboardActive) {
        updateSelectedResult(resultItems);
    }
}

// Add minimal mouse handlers to result items
function addMouseHandlers() {
    const resultItems = document.querySelectorAll('.result-item');
    
    resultItems.forEach((item, index) => {
        // Only update selection on click, not hover
        item.addEventListener('mousedown', () => {
            if (isKeyboardActive) {
                isKeyboardActive = false;
                document.body.classList.remove('keyboard-active');
            }
            selectedResultIndex = index;
            updateSelectedResult(resultItems);
        });
    });
}

// Export the functions needed by other modules
window.keyboardNav = {
    init: initKeyboardNavigation,
    reset: resetSelection,
    addMouseHandlers: addMouseHandlers
}; 