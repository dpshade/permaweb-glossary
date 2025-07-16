# Known Issues & Bug Tracker

## Critical Issues 🔴

### 1. Wayfinder URL Integration Failure
**Status:** Open  
**Priority:** High  
**Component:** Wayfinder Utils (`src/js/wayfinder-utils.js`)

**Description:**  
Wayfinder URLs are broken and not working as intended. The wayfinder utility functions are not properly routing or resolving gateway URLs.

**Expected Behavior:**  
- Wayfinder should provide optimal gateway routing
- URLs should resolve correctly through the wayfinder system
- Gateway selection should be automatic and efficient

**Current Behavior:**  
- Wayfinder URLs fail to resolve
- Gateway routing is not functioning
- Users cannot access content through wayfinder URLs

**Latest Updates (July 2025):**
- Gateway pinging logic was optimized for performance and reliability.
- Timeouts have been reduced, and gateway verification on startup has been disabled to prevent the app from hanging.
- While these changes improve stability, the core URL resolution issue may still persist.

**Reproduction Steps:**  
1. Navigate to the application
2. Attempt to access content through wayfinder URLs
3. Observe broken/non-functional URLs

**Technical Details:**  
- Affects: `wayfinder-utils.js`
- Related functions: Gateway resolution and URL routing
- Potential root cause: API changes or configuration issues

---

### ~~2. Documentation Search Not Using FlexSearch Index~~
**Status:** Fixed  
**Fixed in:** Latest release  
**Priority:** High  
**Component:** Search System

**Description:**  
When toggling to "Documentation" mode, the application was not using the alternative FlexSearch index built from `docs-index.json`. The documentation search functionality was incomplete.

**Solution:**  
A comprehensive refactor of the search system was completed, replacing the legacy `enhanced-search.js` with a more robust and modular architecture.

**Technical Changes:**
- **New Architecture:**
  - `SearchManager`: Controls the overall search state and orchestrates different providers.
  - `SearchState`: Manages UI state (e.g., `has-results`).
  - `SearchProvider`: Base class for different search implementations.
  - `BasicSearchProvider`: Handles glossary search.
  - `EnhancedSearchProvider`: Handles documentation search, loading the `docs-index.json` FlexSearch index.
  - `permaweb-config.js` and `search-config.js` were added for easier configuration.
- **Files Modified:**
  - `src/js/main.js`: Streamlined to use the new `SearchManager`.
  - `package.json`: Build scripts updated.
- **Files Removed:**
  - `src/js/enhanced-search.js`: Deprecated and removed.
- **Implementation Completed:**
  - Fully functional mode switching between glossary and documentation search.
  - Asynchronous loading of the documentation index from remote sources.
  - Standardized results display for both search modes.

**Critical Bug Fixes Applied:**
- **Fixed Race Conditions**: The new architecture ensures data is loaded before search is initialized.
- **Resolved Event Handler Conflicts**: Centralized event handling in the new modules.
- **Standardized Results Styling**: Documentation results now use identical HTML structure and CSS classes as glossary results.
- **Improved Error Handling**: The system now has better fallbacks and displays clear error states.

---

## Minor Issues 🟡

### 3. Theme Toggle Accessibility
**Status:** Open  
**Priority:** Medium  
**Component:** Theme System

**Description:**  
Theme toggle button lacks proper ARIA labels and keyboard navigation support.

**Fix Required:**  
- Add proper ARIA attributes
- Ensure keyboard accessibility
- Add screen reader announcements

---

### ~~4. Mobile Responsive Issues~~
**Status:** Fixed  
**Fixed in:** Latest release  
**Priority:** Medium  
**Component:** CSS Responsive Design

**Description:**  
Some layout issues on very small mobile devices (<350px width).

**Symptoms:**  
- Search input could overflow container.
- Random term tags could break layout.

**Solution:**
- The main layout, search container, and results display have been significantly improved with `flexbox` and `vh` units for better viewport fitting on mobile devices.
- The random terms container is now hidden when search results are displayed, preventing layout conflicts.

---

### 5. Error Message Improvements
**Status:** In Progress  
**Priority:** Low  
**Component:** Error Handling & CSS

**Description:**  
Generic error messages don't provide enough context for users when network or data loading fails.

**Latest Updates (July 2025):**
- CSS styles for a standardized error state and retry button (`.error-state`, `.retry-button`) have been implemented.
- This provides the foundation for displaying more user-friendly error messages.

**Improvement Needed:**  
- Integrate the new styles to show specific error messages.
- Implement retry mechanisms in the JavaScript logic.
- Add offline indicators.

---

## Recently Fixed ✅

### ~~JavaScript forEach Error~~
**Status:** Fixed  
**Fixed in:** Latest release  
**Component:** Enhanced Search

**Description:**  
`this.glossaryData.forEach is not a function` error due to JSON structure mismatch.

**Solution:**  
Updated `loadGlossaryData()` to handle `{terms: [...]}` JSON structure with proper validation.

---

### ~~Title Toggle Implementation~~
**Status:** Fixed  
**Fixed in:** Latest release  
**Component:** UI/Title System

**Description:**  
Implemented clickable title toggle between "Glossary" and "Documentation" modes.

**Solution:**  
- Removed GitHub link from title
- Added clickable span with hover effects
- Implemented JavaScript toggle functionality
- Added CSS styling for interactive states

---

## Reporting New Bugs

### Bug Report Template
When reporting new bugs, please include:

1. **Environment:**
   - Browser and version
   - Operating system
   - Device type (desktop/mobile/tablet)

2. **Steps to Reproduce:**
   - Detailed step-by-step instructions
   - Expected vs actual behavior

3. **Technical Information:**
   - Console errors (if any)
   - Network issues (if applicable)
   - Screenshots or recordings

4. **Impact:**
   - How many users affected
   - Severity level
   - Workarounds (if known)

### Labels & Priority System

**Priority Levels:**
- 🔴 **Critical:** Breaks core functionality, affects all users
- 🟡 **Medium:** Affects some users or specific features
- 🟢 **Low:** Minor issues, cosmetic problems, edge cases

**Component Labels:**
- `ui/ux` - User interface and experience issues
- `search` - Search functionality problems
- `data` - Data loading or processing issues
- `performance` - Speed and optimization problems
- `accessibility` - A11y compliance issues
- `mobile` - Mobile-specific problems
- `integration` - Third-party service issues

---

*Last Updated: July 2025*