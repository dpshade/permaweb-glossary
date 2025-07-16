// Enhanced Keyboard Navigation for Dual-Mode Search
// Supports both glossary and documentation search modes

export class EnhancedKeyboardNav {
    constructor(searchInput, resultsContainer) {
        this.selectedResultIndex = -1;
        this.isKeyboardActive = false;
        this.searchInput = searchInput;
        this.resultsContainer = resultsContainer;
        this.resultItems = [];

        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // We will be calling handleKeyDown from the EnhancedPermwebSearch class
        // so no listener is needed here for the searchInput anymore.
        
        // Mouse movement detection to deactivate keyboard mode
        document.addEventListener('mousemove', () => {
            if (this.isKeyboardActive) {
                this.isKeyboardActive = false;
                this.reset();
            }
        });
    }

    updateResultItems() {
        this.resultItems = this.resultsContainer.querySelectorAll('.result-item, .doc-result-item');
    }

    reset() {
        this.selectedResultIndex = -1;
        this.isKeyboardActive = false;
        this.clearSelection();
    }

    handleKeyDown(event) {
        if (this.resultItems.length === 0) return;

        this.isKeyboardActive = true;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.navigate(1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.navigate(-1);
                break;
            case 'Enter':
                event.preventDefault();
                this.activateSelection();
                break;
            case 'Escape':
                this.reset();
                this.searchInput.value = '';
                // You might want to clear results in the main search class
                break;
        }
    }

    navigate(direction) {
        this.clearSelection();

        this.selectedResultIndex += direction;

        if (this.selectedResultIndex >= this.resultItems.length) {
            this.selectedResultIndex = 0;
        } else if (this.selectedResultIndex < 0) {
            this.selectedResultIndex = this.resultItems.length - 1;
        }

        this.selectItem(this.selectedResultIndex);
    }

    activateSelection() {
        if (this.selectedResultIndex > -1 && this.resultItems[this.selectedResultIndex]) {
            this.resultItems[this.selectedResultIndex].click();
        }
    }

    selectItem(index) {
        const item = this.resultItems[index];
        if (item) {
            item.classList.add('selected');
            item.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }

    clearSelection() {
        if (this.selectedResultIndex > -1 && this.resultItems[this.selectedResultIndex]) {
            this.resultItems[this.selectedResultIndex].classList.remove('selected');
        }
    }
}