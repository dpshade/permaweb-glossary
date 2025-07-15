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

**Reproduction Steps:**  
1. Navigate to the application
2. Attempt to access content through wayfinder URLs
3. Observe broken/non-functional URLs

**Technical Details:**  
- Affects: `wayfinder-utils.js`
- Related functions: Gateway resolution and URL routing
- Potential root cause: API changes or configuration issues

---

### 2. Documentation Search Not Using FlexSearch Index
**Status:** Open  
**Priority:** High  
**Component:** Enhanced Search (`src/js/enhanced-search.js`)

**Description:**  
When toggling to "Documentation" mode (previously "Dictionary"), the application is not using the alternative FlexSearch index built from `docs-index.json`. The documentation search functionality is incomplete.

**Expected Behavior:**  
- Clicking "Glossary" → "Documentation" should switch to docs search mode
- Documentation search should use FlexSearch index from `docs-index.json`
- Search results should show Permaweb documentation pages
- Search should be fast and relevant using the pre-built index

**Current Behavior:**  
- Title toggle works (Glossary ↔ Documentation)
- Documentation search mode is not implemented
- Only glossary search is functional
- `docs-index.json` FlexSearch index is not being utilized

**Reproduction Steps:**  
1. Load the application (shows "Glossary" mode)
2. Click on "Glossary" to toggle to "Documentation"
3. Observe that search still uses glossary data
4. No documentation search functionality available

**Technical Details:**  
- **Files affected:**
  - `src/js/enhanced-search.js` (contains docs search framework)
  - `src/js/main.js` (needs integration with enhanced-search)
- **Missing implementation:**
  - Mode switching logic in main.js
  - FlexSearch index loading for documentation
  - Results display for documentation format
- **Available resources:**
  - `docs-index.json` contains pre-indexed documentation
  - Enhanced search class has docs search methods ready

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

### 4. Mobile Responsive Issues
**Status:** Open  
**Priority:** Medium  
**Component:** CSS Responsive Design

**Description:**  
Some layout issues on very small mobile devices (<350px width).

**Symptoms:**  
- Search input may overflow container
- Random term tags can break layout
- Navigation buttons may be too small

---

### 5. Error Message Improvements
**Status:** Open  
**Priority:** Low  
**Component:** Error Handling

**Description:**  
Generic error messages don't provide enough context for users when network or data loading fails.

**Improvement Needed:**  
- More specific error messages
- Retry mechanisms
- Offline indicators

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