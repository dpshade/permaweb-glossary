// Enhanced Keyboard Navigation for Dual-Mode Search
// Supports both glossary and documentation search modes

class EnhancedKeyboardNavigation {
    constructor() {
        this.selectedResultIndex = 0;
        this.isKeyboardActive = false;
        this.isIframeMode = window.self !== window.top;
        this.currentMode = 'glossary'; // Track current search mode
        
        // DOM elements
        this.searchInput = null;
        this.resultsContainer = null;
        this.modeButtons = null;
        
        this.initialize();
    }
    
    initialize() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupNavigation());
        } else {
            this.setupNavigation();
        }
    }
    
    setupNavigation() {
        // Get DOM elements
        this.searchInput = document.getElementById('searchInput');
        this.resultsContainer = document.getElementById('results');
        this.modeButtons = document.querySelectorAll('.mode-button');
        
        if (!this.searchInput || !this.resultsContainer) {
            console.warn('Enhanced keyboard navigation: Required elements not found');
            return;
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Monitor search mode changes
        this.monitorModeChanges();
    }
    
    setupEventListeners() {
        // Search input keyboard navigation
        this.searchInput.addEventListener('keydown', (e) => this.handleKeyNavigation(e));
        
        // Search input typing detection
        this.searchInput.addEventListener('input', () => {
            this.isKeyboardActive = true;
            document.body.classList.add('keyboard-active');
        });
        
        // Global mouse movement detection to deactivate keyboard mode
        document.addEventListener('mousemove', () => {
            if (this.isKeyboardActive) {
                this.isKeyboardActive = false;
                document.body.classList.remove('keyboard-active');
                this.clearSelectedResult();
            }
        });
        
        // Mode button keyboard navigation
        this.modeButtons.forEach((button, index) => {
            button.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    const nextIndex = e.key === 'ArrowRight' 
                        ? (index + 1) % this.modeButtons.length
                        : (index - 1 + this.modeButtons.length) % this.modeButtons.length;
                    this.modeButtons[nextIndex].focus();
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    button.click();
                    this.searchInput.focus();
                }
            });
        });
    }
    
    monitorModeChanges() {
        // Observer to detect when search mode changes
        const observer = new MutationObserver(() => {
            const activeButton = document.querySelector('.mode-button.active');
            if (activeButton) {
                const newMode = activeButton.dataset.mode;
                if (newMode !== this.currentMode) {
                    this.currentMode = newMode;
                    this.selectedResultIndex = 0; // Reset selection
                }
            }
        });
        
        // Observe mode button changes
        this.modeButtons.forEach(button => {
            observer.observe(button, { attributes: true, attributeFilter: ['class'] });
        });
    }
    
    handleKeyNavigation(event) {
        // Only process if we have results
        if (!this.hasResults()) {
            // Handle mode switching when no results
            if (event.key === 'Tab' && event.shiftKey) {
                event.preventDefault();
                this.focusLastModeButton();
            } else if (event.key === 'Tab') {
                event.preventDefault();
                this.focusFirstModeButton();
            }
            return;
        }
        
        const resultItems = this.getResultItems();
        const resultCount = resultItems.length;
        
        if (resultCount === 0) return;
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.navigateResults(1, resultItems);
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                this.navigateResults(-1, resultItems);
                break;
                
            case 'Enter':
                event.preventDefault();
                this.activateSelectedResult(resultItems);
                break;
                
            case 'Escape':
                event.preventDefault();
                this.clearSearchAndResults();
                break;
                
            case 'Tab':
                if (event.shiftKey) {
                    event.preventDefault();
                    this.focusLastModeButton();
                } else {
                    event.preventDefault();
                    this.focusFirstResult(resultItems);
                }
                break;
                
            // Quick mode switching
            case '1':
                if (event.altKey) {
                    event.preventDefault();
                    this.switchToMode('glossary');
                }
                break;
                
            case '2':
                if (event.altKey) {
                    event.preventDefault();
                    this.switchToMode('docs');
                }
                break;
        }
    }
    
    navigateResults(direction, resultItems) {
        // Clear previous selection
        this.clearSelectedResult();
        
        // Calculate new index
        this.selectedResultIndex += direction;
        
        // Wrap around
        if (this.selectedResultIndex >= resultItems.length) {
            this.selectedResultIndex = 0;
        } else if (this.selectedResultIndex < 0) {
            this.selectedResultIndex = resultItems.length - 1;
        }
        
        // Apply selection
        this.selectResult(resultItems[this.selectedResultIndex]);
        
        // Scroll into view
        this.scrollToSelectedResult(resultItems[this.selectedResultIndex]);
        
        // Update keyboard active state
        this.isKeyboardActive = true;
        document.body.classList.add('keyboard-active');
    }
    
    activateSelectedResult(resultItems) {
        if (this.selectedResultIndex >= 0 && this.selectedResultIndex < resultItems.length) {
            const selectedResult = resultItems[this.selectedResultIndex];
            
            if (this.currentMode === 'glossary') {
                // Handle glossary result activation
                this.activateGlossaryResult(selectedResult);
            } else {
                // Handle documentation result activation
                this.activateDocumentationResult(selectedResult);
            }
        }
    }
    
    activateGlossaryResult(resultElement) {
        const term = resultElement.getAttribute('data-term');
        if (term) {
            // Trigger click event or custom glossary action
            resultElement.click();
        }
    }
    
    activateDocumentationResult(resultElement) {
        const url = resultElement.getAttribute('data-url');
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }
    
    selectResult(resultElement) {
        if (resultElement) {
            resultElement.classList.add('keyboard-selected');
            resultElement.setAttribute('aria-selected', 'true');
        }
    }
    
    clearSelectedResult() {
        const selected = this.resultsContainer.querySelector('.keyboard-selected');
        if (selected) {
            selected.classList.remove('keyboard-selected');
            selected.removeAttribute('aria-selected');
        }
    }
    
    scrollToSelectedResult(resultElement) {
        if (resultElement) {
            resultElement.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }
    
    getResultItems() {
        if (this.isIframeMode) {
            return this.resultsContainer.querySelectorAll('.result-display');
        } else {
            // Handle both glossary and documentation results
            return this.resultsContainer.querySelectorAll('.result-item');
        }
    }
    
    hasResults() {
        const resultItems = this.getResultItems();
        return resultItems.length > 0 && this.resultsContainer.style.display !== 'none';
    }
    
    focusFirstResult(resultItems) {
        if (resultItems.length > 0) {
            this.selectedResultIndex = 0;
            this.clearSelectedResult();
            this.selectResult(resultItems[0]);
            this.scrollToSelectedResult(resultItems[0]);
            this.isKeyboardActive = true;
            document.body.classList.add('keyboard-active');
        }
    }
    
    focusFirstModeButton() {
        if (this.modeButtons.length > 0) {
            this.modeButtons[0].focus();
        }
    }
    
    focusLastModeButton() {
        if (this.modeButtons.length > 0) {
            this.modeButtons[this.modeButtons.length - 1].focus();
        }
    }
    
    switchToMode(mode) {
        const targetButton = document.querySelector(`[data-mode="${mode}"]`);
        if (targetButton && !targetButton.classList.contains('active')) {
            targetButton.click();
            this.searchInput.focus();
        }
    }
    
    clearSearchAndResults() {
        this.searchInput.value = '';
        this.searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        this.selectedResultIndex = 0;
        this.clearSelectedResult();
    }
    
    // Auto-select first result when results appear
    autoSelectFirstResult() {
        if (this.isKeyboardActive && this.hasResults()) {
            const resultItems = this.getResultItems();
            if (resultItems.length > 0) {
                this.selectedResultIndex = 0;
                this.selectResult(resultItems[0]);
            }
        }
    }
    
    // Method to be called when new results are displayed
    onResultsDisplayed() {
        // Auto-select first result if keyboard is active
        setTimeout(() => {
            this.autoSelectFirstResult();
        }, 50); // Small delay to ensure DOM is updated
    }
}

// Add CSS for keyboard selection styling
function addKeyboardNavigationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Keyboard selection indicator */
        .result-item.keyboard-selected {
            background: var(--ao-accent-color) !important;
            color: white !important;
            transform: translateY(-2px) !important;
            box-shadow: 4px 4px 0 var(--ao-shadow-color) !important;
        }
        
        .result-item.keyboard-selected .result-title,
        .result-item.keyboard-selected .term-name {
            color: white !important;
        }
        
        .result-item.keyboard-selected .result-breadcrumbs,
        .result-item.keyboard-selected .result-snippet,
        .result-item.keyboard-selected .result-meta,
        .result-item.keyboard-selected .term-definition,
        .result-item.keyboard-selected .term-aliases,
        .result-item.keyboard-selected .related-terms {
            color: rgba(255, 255, 255, 0.9) !important;
        }
        
        .result-item.keyboard-selected .term-category {
            background: rgba(255, 255, 255, 0.2) !important;
            color: white !important;
        }
        
        .result-item.keyboard-selected .highlight {
            background: rgba(255, 255, 255, 0.3) !important;
            color: white !important;
        }
        
        /* Keyboard active state */
        .keyboard-active .result-item:not(.keyboard-selected):hover {
            background: var(--ao-result-hover) !important;
            transform: none !important;
            box-shadow: none !important;
        }
        
        /* Mode button focus styles */
        .mode-button:focus {
            outline: 2px solid var(--ao-accent-color);
            outline-offset: 2px;
        }
    `;
    document.head.appendChild(style);
}

// Initialize enhanced keyboard navigation
let enhancedKeyboardNav = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEnhancedKeyboardNav);
} else {
    initializeEnhancedKeyboardNav();
}

function initializeEnhancedKeyboardNav() {
    addKeyboardNavigationStyles();
    enhancedKeyboardNav = new EnhancedKeyboardNavigation();
}

// Export for use by the main search application
window.enhancedKeyboardNav = enhancedKeyboardNav;

export { EnhancedKeyboardNavigation };