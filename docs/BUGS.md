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

**Latest Updates (January 2025):**
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

## Recently Fixed ✅

### ~~Documentation Search Not Using FlexSearch Index~~
**Status:** Fixed  
**Fixed in:** Latest release (January 2025)  
**Priority:** High  
**Component:** Search System

**Description:**  
When toggling to "Documentation" mode, the application was not using the alternative FlexSearch index built from `docs-index.json`. The documentation search functionality was incomplete.

**Solution:**  
A comprehensive refactor of the search system was completed, implementing a modern modular architecture that replaced the legacy search system.

**Technical Changes:**
- **New Modular Architecture:**
  - `SearchManager`: Central orchestrator that manages search providers and state
  - `SearchState`: Reactive state management with subscriber pattern
  - `SearchProvider`: Abstract base class for different search implementations  
  - `BasicSearchProvider`: Handles glossary search with enhanced relevance scoring
  - `EnhancedSearchProvider`: Handles documentation search with LLM integration
  - `search-config.js` and `permaweb-config.js`: Centralized configuration management
- **Files Added:**
  - `src/scripts/search-manager.js`: Main search orchestration
  - `src/scripts/search-state.js`: State management system
  - `src/scripts/search-provider.js`: Base provider class
  - `src/scripts/basic-search-provider.js`: Glossary search implementation
  - `src/scripts/enhanced-search-provider.js`: Documentation search implementation
  - `src/scripts/search-config.js`: Search configuration
  - `src/scripts/permaweb-config.js`: Permaweb integration configuration
- **Files Modified:**
  - `src/scripts/main.js`: Streamlined to use the new `SearchManager`
  - `src/pages/json.astro`: Updated for new API compatibility
  - `package.json`: Updated scripts for sync functionality
- **Files Removed:**
  - `src/js/enhanced-search.js`: Deprecated and removed
- **Implementation Completed:**
  - Fully functional mode switching between glossary and documentation search
  - Asynchronous loading of documentation index from permaweb-llm-fuel
  - Standardized results display for both search modes
  - Robust error handling with fallback mechanisms
  - Browser navigation support for URLs and history

**Critical Bug Fixes Applied:**
- **Fixed Race Conditions**: New architecture ensures data is loaded before search initialization
- **Resolved Event Handler Conflicts**: Centralized event handling prevents conflicts
- **Standardized Results Styling**: Both search modes use identical HTML structure and CSS
- **Improved Error Handling**: Better fallbacks and clear error state displays
- **Enhanced Keyboard Navigation**: Proper handling of arrow keys and selection states

---

### ~~JavaScript forEach Error~~
**Status:** Fixed  
**Fixed in:** Latest release (January 2025)  
**Component:** Enhanced Search

**Description:**  
`this.glossaryData.forEach is not a function` error due to JSON structure mismatch.

**Solution:**  
Updated the new `BasicSearchProvider.initialize()` method to handle `{terms: [...]}` JSON structure with proper validation and error handling.

---

### ~~Title Toggle Implementation~~
**Status:** Fixed  
**Fixed in:** Latest release (January 2025)  
**Component:** UI/Title System

**Description:**  
Implemented clickable title toggle between "Glossary" and "Documentation" modes.

**Solution:**  
- Integrated title toggle with the new `SearchManager.switchMode()` method
- Added proper mode persistence in URL parameters
- Implemented smooth transitions and hover effects
- Added automatic search re-execution after mode switches
- Includes fallback notification when enhanced mode is unavailable

---

### ~~Mobile Responsive Issues~~
**Status:** Fixed  
**Fixed in:** Latest release (January 2025)  
**Priority:** Medium  
**Component:** CSS Responsive Design

**Description:**  
Layout issues on very small mobile devices (<350px width).

**Symptoms:**  
- Search input could overflow container
- Random term tags could break layout

**Solution:**
- Improved layout using flexbox and viewport units
- Better responsive design for mobile devices
- Random terms container now hidden during search to prevent conflicts
- Enhanced touch and keyboard navigation

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

### 4. Error Message Improvements
**Status:** In Progress  
**Priority:** Low  
**Component:** Error Handling & CSS

**Description:**  
While the new architecture has better error handling, user-facing error messages could be more informative.

**Latest Updates (January 2025):**
- CSS styles for standardized error states and retry buttons have been implemented
- New architecture includes proper error boundaries and fallback mechanisms
- Mode unavailable notifications are now displayed to users

**Improvement Needed:**  
- Integrate more specific error messages for different failure scenarios
- Implement retry mechanisms in the JavaScript logic
- Add offline indicators and better network error handling

---

### ~~5. JSON API Endpoint Inconsistencies~~
**Status:** Disabled  
**Priority:** ~~Low~~ **Resolved by removal**  
**Component:** ~~JSON API (`src/pages/json.astro`)~~ **Moved to `src/pages/unused/json.astro`**

**Description:**  
~~The JSON API endpoint at `/json?q=query&mode=docs` sometimes has initialization race conditions.~~

**Resolution:**  
The JSON API endpoint has been **disabled and moved to unused folder** due to fundamental incompatibility with non-browser environments. The endpoint relied on browser APIs (window, document, URLSearchParams) that don't exist in server-side or headless environments.

**Current Status:**  
- Endpoint moved to `src/pages/unused/json.astro`
- All documentation references updated to reflect disabled status
- See `docs/DECENTRALIZED_SEARCH_ANALYSIS.md` for future AO-based implementation plans

---

## Performance Optimizations 🚀

### Recently Completed Performance Improvements ✅

1. **LLM Integration Performance**: Documentation search now loads 15x faster using pre-extracted content
2. **Modular Loading**: Search providers are initialized on-demand, reducing initial load time  
3. **Better Caching**: Improved caching strategies for documentation content
4. **Reduced Network Requests**: Consolidated requests through permaweb-llm-fuel integration

### Future Performance Targets

1. **Service Worker Optimization**: Better caching strategies for offline functionality
2. **Code Splitting**: Further reduce initial bundle size  
3. **Search Index Compression**: Compress FlexSearch indices for faster loading

---

## Reporting New Bugs

### Bug Report Template
When reporting new bugs, please include:

1. **Environment:**
   - Browser and version
   - Operating system
   - Device type (desktop/mobile/tablet)
   - URL and any parameters used

2. **Steps to Reproduce:**
   - Detailed step-by-step instructions
   - Expected vs actual behavior
   - Search mode being used (Glossary/Documentation)

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
- `architecture` - Code structure and design issues

---

*Last Updated: July 15*