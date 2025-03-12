// Keyboard navigation for search results
let selectedResultIndex = -1; // Track the currently selected result

// Initialize keyboard navigation
function initKeyboardNavigation() {
    // Add keyboard navigation event listener to search input
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('keydown', handleKeyNavigation);
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
            selectedResultIndex = (selectedResultIndex + 1) % resultCount;
            updateSelectedResult(resultItems);
            break;
            
        case 'ArrowUp':
            event.preventDefault(); // Prevent scrolling the page
            selectedResultIndex = (selectedResultIndex - 1 + resultCount) % resultCount;
            updateSelectedResult(resultItems);
            break;
            
        case 'Enter':
            event.preventDefault(); // Prevent form submission
            if (selectedResultIndex >= 0 && selectedResultIndex < resultCount) {
                // Get the selected result
                const selectedResult = resultItems[selectedResultIndex];
                const resultIndex = parseInt(selectedResult.getAttribute('data-index'));
                
                // Trigger click on the selected item
                selectedResult.click();
            } else if (resultCount > 0) {
                // If no item is selected but we have results, select the first one
                resultItems[0].click();
            }
            break;
            
        case 'Escape':
            // Clear results and reset
            resultsContainer.innerHTML = '';
            resultsContainer.classList.remove('has-results');
            document.querySelector('.search-container').classList.remove('has-results');
            selectedResultIndex = -1;
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
    // Set to 0 to select the first result by default
    selectedResultIndex = 0;
    
    // Apply the selection to the first result immediately
    const resultItems = document.querySelectorAll('.result-item');
    if (resultItems.length > 0) {
        updateSelectedResult(resultItems);
    }
}

// Add mouseover handlers to result items
function addMouseHandlers() {
    const resultItems = document.querySelectorAll('.result-item');
    
    resultItems.forEach((item, index) => {
        item.addEventListener('mouseover', () => {
            selectedResultIndex = index;
            updateSelectedResult(resultItems);
        });
    });
}

// Export functions
window.keyboardNav = {
    init: initKeyboardNavigation,
    reset: resetSelection,
    addMouseHandlers: addMouseHandlers
}; 