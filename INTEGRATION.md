# 🔗 Permaweb LLM Fuel Integration

This document explains how the Permaweb Glossary leverages the [permaweb-llm-fuel](../permaweb-llm-fuel/) project to provide fast, comprehensive documentation search without slow individual page fetching.

## 🚀 **Problem Solved**

**Before:** The glossary's enhanced search was slow because it fetched content from each documentation page individually, which could take 30+ seconds for hundreds of pages.

**After:** The glossary now uses pre-extracted content from permaweb-llm-fuel's LLM text files, reducing search index loading from 30+ seconds to ~2-3 seconds.

## 🏗️ **Architecture Overview**

```
permaweb-llm-fuel/              permaweb-glossary/
├── public/                     ├── src/js/
│   ├── docs-index.json        │   ├── enhanced-search-provider.js  ← Uses LLM files
│   ├── hyperbeam-llms.txt ────────→ permaweb-config.js           ← Configuration
│   ├── ao-llms.txt            │   └── ...
│   ├── ario-llms.txt          └── scripts/
│   ├── arweave-llms.txt           └── sync-permaweb-llm-data.js    ← Optional sync
│   └── permaweb-glossary-llms.txt
```

### Data Flow

1. **permaweb-llm-fuel** crawls documentation sites and generates:
   - `docs-index.json` - Page metadata (URLs, titles, breadcrumbs)
   - `*-llms.txt` - Full extracted content for each site

2. **permaweb-glossary** loads both:
   - Uses `docs-index.json` for page structure
   - Uses `*-llms.txt` files for pre-extracted content
   - Builds search index with full content without individual fetching

## 📁 **Key Integration Components**

### 1. Enhanced Search Provider (`src/js/enhanced-search-provider.js`)

The main integration point that:
- Loads documentation index from permaweb-llm-fuel
- Fetches LLM text files with pre-extracted content
- Parses LLM text format to extract content per URL
- Creates FlexSearch index with full content

**Key Methods:**
- `_loadLLMTextFiles()` - Loads all LLM text files in parallel
- `_parseLLMTextFile()` - Parses LLM text format
- `_processDocumentationDataWithLLMText()` - Combines metadata + content

### 2. Configuration (`src/js/permaweb-config.js`)

Centralizes all URLs and settings:
- **Environment Detection** - Automatically selects URLs based on hostname
- **Fallback URLs** - GitHub raw files as backup
- **Feature Flags** - Enable/disable pre-extracted content usage
- **Debug Logging** - Configurable logging for development

### 3. Sync Script (`scripts/sync-permaweb-llm-data.js`)

Optional offline sync for development:
- Copies data from local permaweb-llm-fuel build
- Creates enhanced index with pre-extracted content
- Useful for local development without network dependencies

## 🔧 **Configuration Options**

### Environment URLs

The system automatically detects the environment and uses appropriate URLs:

| Environment | Base URL | Use Case |
|------------|----------|----------|
| **Local** | `http://localhost:4321` | Development with local permaweb-llm-fuel |
| **Preview** | `https://preview-llm.vercel.app` | Preview deployments |
| **Production** | `https://fuel_permawebllms.arweave.net` | Live production |
| **Fallback** | `https://raw.githubusercontent.com/...` | GitHub backup |

### Feature Flags

```javascript
// src/js/permaweb-config.js
features: {
    usePreExtractedContent: true,  // Use LLM text files (recommended)
    fallbackToLive: false,         // Fallback to individual page fetching
    cacheResults: true,            // Cache LLM text contents
    enableQualityScoring: true     // Use quality scores from extraction
}
```

## 🚀 **Usage Instructions**

### 1. Standard Usage (Automatic)

The integration works automatically when you run the glossary:

```bash
cd permaweb-glossary
bun run dev
```

The enhanced search will automatically:
1. Detect environment (local/preview/production)
2. Load appropriate URLs from permaweb-config.js
3. Fetch pre-extracted content from LLM text files
4. Build search index with full content

### 2. Local Development with Sync

For offline development, you can sync data locally:

```bash
# Ensure permaweb-llm-fuel is built first
cd ../permaweb-llm-fuel
bun run build

# Sync data to glossary
cd ../permaweb-glossary
bun run sync        # Sync data from permaweb-llm-fuel
bun run sync:dev    # Sync + start dev server
```

### 3. Manual URL Configuration

Override URLs for testing:

```javascript
// src/js/permaweb-config.js - modify base URLs
const PERMAWEB_LLM_FUEL_URLS = {
    production: 'https://your-custom-url.com',
    // ...
};
```

## 📊 **Performance Improvements**

| Metric | Before (Individual Fetching) | After (LLM Files) | Improvement |
|--------|------------------------------|-------------------|-------------|
| **Index Load Time** | 30-45 seconds | 2-3 seconds | **~15x faster** |
| **Network Requests** | 100+ individual pages | 5 LLM text files | **~20x fewer** |
| **Server Load** | High (many requests) | Low (few files) | **Much lower** |
| **Cache Efficiency** | Poor (many URLs) | Excellent (few files) | **Better caching** |
| **Offline Support** | None | Full (with sync) | **Offline capable** |

## 🔍 **LLM Text File Format**

The LLM text files use this format:

```txt
# Document 1 Title

Document Number: 1
Source: https://example.com/page1
Words: 500
Quality Score: 0.8
Extraction Method: semantic

[Full extracted content here...]

---

# Document 2 Title

Document Number: 2
Source: https://example.com/page2
...
```

The parser extracts:
- **Source URL** - Maps content back to original page
- **Content** - Full extracted text from the page
- **Metadata** - Quality score, word count, etc.

## 🛠️ **Development Workflow**

### 1. Working on LLM Fuel Changes

```bash
# Make changes to permaweb-llm-fuel
cd permaweb-llm-fuel
bun run crawl:force  # Recrawl with changes
bun run build

# Test in glossary
cd ../permaweb-glossary
bun run sync:dev     # Sync + test locally
```

### 2. Working on Glossary Search

```bash
# Glossary changes don't require LLM fuel rebuild
cd permaweb-glossary
bun run dev  # Uses production LLM files by default
```

### 3. Testing Different Environments

```javascript
// Temporarily override in permaweb-config.js for testing
const getBaseUrl = () => 'https://test-url.com';
```

## 🚨 **Troubleshooting**

### Search Not Working
- Check browser console for network errors
- Verify permaweb-llm-fuel URLs are accessible
- Try fallback URLs if primary fails

### Slow Loading
- Check if using pre-extracted content (`usePreExtractedContent: true`)
- Verify LLM text files are loading (not individual pages)
- Check network timeout settings in config

### Content Missing
- Ensure permaweb-llm-fuel has crawled the sites recently
- Check LLM text file format/parsing
- Verify URLs match between index and LLM files

### Local Development Issues
- Run `bun run sync` to get fresh data locally
- Check relative paths in sync script
- Ensure permaweb-llm-fuel is built first

## 🔄 **Deployment**

### Production Updates

1. **permaweb-llm-fuel** updates automatically via GitHub Actions daily
2. **permaweb-glossary** picks up new data automatically (no rebuild needed)
3. Changes to glossary code require redeployment

### Manual Updates

```bash
# Force update permaweb-llm-fuel data
cd permaweb-llm-fuel
bun run crawl:force
git add public/ && git commit -m "Update docs index" && git push

# Glossary will automatically use new data
```

## 📈 **Future Enhancements**

### Potential Improvements

1. **Incremental Updates** - Only sync changed content
2. **Compression** - Gzip LLM text files for faster loading
3. **CDN Integration** - Serve LLM files from CDN
4. **Smart Caching** - More sophisticated cache invalidation
5. **Real-time Sync** - WebSocket updates when content changes

### Integration Opportunities

1. **Shared Components** - Extract common search logic
2. **Unified Configuration** - Single config for both projects
3. **Cross-References** - Link between glossary terms and documentation
4. **Analytics** - Track search patterns across both projects

---

## 💡 **Key Benefits**

✅ **Fast Loading** - 15x faster search index creation  
✅ **Reduced Load** - 20x fewer network requests  
✅ **Better UX** - Near-instant search availability  
✅ **Offline Support** - Works without network (with sync)  
✅ **Maintainable** - Centralized configuration and fallbacks  
✅ **Scalable** - Handles hundreds of documentation pages efficiently  

This integration demonstrates effective reuse of computed work, eliminating duplicate effort while providing a significantly better user experience. 