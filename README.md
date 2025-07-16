# Permaweb Glossary Search

A modern, lightning-fast search application for the Permaweb Glossary built with **Astro** and featuring dual-mode search capabilities. This application provides both **Glossary search** for specific terms and **Documentation search** for comprehensive Permaweb ecosystem documentation.

## ✨ Features

### 🔍 **Dual-Mode Search**
- **Glossary Mode**: Fast search across curated Permaweb terms and definitions
- **Documentation Mode**: Comprehensive search across Arweave, AO, AR.IO, and HyperBEAM documentation
- **Seamless Mode Switching**: One-click toggle between search modes with URL persistence

### ⚡ **Performance & UX**
- **Lightning Fast**: Documentation search loads 15x faster using pre-extracted content
- **Fuzzy Search**: Find relevant content even with typos or partial matches
- **Keyboard Navigation**: Full arrow key support and keyboard shortcuts
- **Mobile Responsive**: Optimized for all device sizes
- **Theme Support**: Light/dark theme with smooth transitions

### 🏗️ **Modern Architecture**
- **Modular Design**: Clean, extensible architecture with pluggable search providers
- **Astro Framework**: Server-side rendering with optimal performance
- **Client-Side Search**: No server dependencies for search functionality
- **Progressive Enhancement**: Works with or without JavaScript

### 🌐 **Integration Ready**
- **Embeddable**: Easy iframe integration for other Permaweb sites
- **JSON API**: ~~Programmatic access at `/json?q=query&mode=docs`~~ (Temporarily disabled - see docs/DECENTRALIZED_SEARCH_ANALYSIS.md)
- **URL Parameters**: Deep linking and shareable search results
- **Color Customization**: Theme integration for different websites

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥16.0.0 or **Bun** ≥1.0.0
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Local Development

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd permaweb-glossary
   bun install
   ```

2. **Start development server:**
   ```bash
   bun dev
   ```
   Navigate to `http://localhost:4321`

3. **With synchronized data** (for local testing with fresh documentation):
   ```bash
   bun run sync:dev
   ```

### Building for Production

```bash
bun run build
```

The built files will be in the `dist/` directory.

## 📁 Project Architecture

### **Modern Modular Structure**
```
permaweb-glossary/
├── src/
│   ├── scripts/                    # Modular JavaScript architecture
│   │   ├── search-manager.js       # Central search orchestrator
│   │   ├── search-state.js         # Reactive state management
│   │   ├── search-provider.js      # Base provider interface
│   │   ├── basic-search-provider.js   # Glossary search implementation
│   │   ├── enhanced-search-provider.js # Documentation search implementation
│   │   ├── search-config.js        # Search configuration
│   │   ├── permaweb-config.js      # Permaweb integration settings
│   │   └── main.js                 # Application initialization
│   ├── pages/                      # Astro pages
│   │   ├── index.astro             # Main search interface
│   │   ├── define.astro            # Term definition page
│   │   └── unused/                 # Disabled components
│   │       └── json.astro          # JSON API endpoint (disabled)
│   ├── layouts/
│   │   └── Layout.astro            # Base layout component
│   └── styles/
│       └── style.css               # Modern CSS with CSS custom properties
├── public/
│   ├── data/
│   │   └── glossary.json           # Glossary database
│   ├── docs-index.json             # Documentation search index
│   └── service-worker.js           # Progressive Web App support
├── scripts/                        # Deployment and utility scripts
│   ├── deploy-production.sh        # Production deployment to Arweave
│   ├── deploy-preview.sh           # Preview deployment to Vercel
│   └── sync-permaweb-llm-data.js   # Local data synchronization
└── docs/                           # Project documentation
    ├── BUGS.md                     # Issue tracking
    └── ROADMAP.md                  # Development roadmap
```

### **Search Provider Architecture**

The application uses a modular search provider system:

- **`SearchManager`**: Orchestrates search providers and manages application state
- **`SearchState`**: Reactive state management with subscriber pattern
- **`BasicSearchProvider`**: Handles glossary search with enhanced relevance scoring
- **`EnhancedSearchProvider`**: Handles documentation search with LLM integration

## 🔧 How It Works

### **Search System**
1. **Initialization**: `SearchManager` registers and initializes search providers
2. **Mode Switching**: Users can toggle between Glossary and Documentation modes
3. **Query Processing**: Each provider implements its own search algorithm:
   - **Basic**: FlexSearch with fuzzy matching and relevance scoring
   - **Enhanced**: Pre-extracted content from permaweb-llm-fuel with full-text search
4. **Result Display**: Unified result rendering with consistent styling

### **Performance Optimization**
- **Pre-extracted Content**: Documentation search uses preprocessed content files
- **Lazy Loading**: Search providers initialize on-demand
- **Efficient Caching**: Smart caching strategies for both content and search indices
- **Minimal Network Requests**: Reduced from 100+ to 5 requests for documentation search

## 🎮 Usage

### **Basic Search**
- Type in the search box to find glossary terms
- Use arrow keys to navigate results
- Press Enter to select a result
- Click the title to toggle between Glossary and Documentation modes

### **URL Parameters**
- `?q=search+term` - Set initial search query
- `?mode=enhanced` - Start in Documentation mode
- `?mode=basic` - Start in Glossary mode (default)

### **JSON API**
~~Access programmatic search at `/json`:~~ (Temporarily disabled)
```bash
# Search glossary (DISABLED)
# curl "https://your-domain.com/json?q=arweave&mode=glossary"

# Search documentation (DISABLED)
# curl "https://your-domain.com/json?q=ao+computer&mode=docs"
```

**Note**: The JSON API endpoint has been temporarily disabled due to technical limitations with non-browser environments. See `docs/DECENTRALIZED_SEARCH_ANALYSIS.md` for details on potential future decentralized search implementation using AO processes.

## 🎨 Customization

### **Embedding in Other Sites**

```html
<!-- Basic embed -->
<iframe 
  src="https://glossary_tiny4vr.permagate.io/" 
  width="100%" 
  height="600px" 
  frameborder="0">
</iframe>

<!-- With custom colors -->
<iframe 
  src="https://glossary_tiny4vr.permagate.io/?bg-color=%23121212&text-color=%23e0e0e0&link-color=%238ab4f8" 
  width="100%" 
  height="600px" 
  frameborder="0">
</iframe>
```

### **Available Color Parameters**

| Parameter | Description | Default |
|-----------|-------------|---------|
| `bg-color` | Background color | `#ffffff` |
| `text-color` | Main text color | `#111111` |
| `link-color` | Link and accent color | `#0066cc` |
| `hover-color` | Hover state color | `#004499` |
| `border-color` | Border color | `#e0e0e0` |
| `input-bg` | Search input background | `#ffffff` |
| `result-bg` | Result item background | `#f8f9fa` |
| `result-hover` | Result hover background | `#e9ecef` |

Note: Colors must be URL-encoded (e.g., `#` becomes `%23`).

### **Adding New Glossary Terms**

Edit `public/data/glossary.json`:

```json
{
  "term": "New Term",
  "definition": "Definition of the new term...",
  "category": "Category Name",
  "related": ["Related Term 1", "Related Term 2"],
  "aliases": ["alias1", "alias2"],
  "docs": ["https://documentation-link.com"]
}
```

## 🚀 Deployment

### **Production Deployment (Arweave)**
```bash
bun run deploy
```
Choose option to create PR or deploy directly to main branch.

### **Preview Deployment (Vercel)**
```bash
bun run deploy:preview
```
Fast preview deployment for testing changes.

### **Manual Vercel Deployment**
```bash
bun run deploy:vercel        # Production
bun run deploy:vercel:preview # Preview
```

## 🔗 Integration with Permaweb LLM Fuel

The documentation search leverages the [permaweb-llm-fuel](../permaweb-llm-fuel/) project for enhanced performance:

- **15x Faster Loading**: Pre-extracted content eliminates individual page fetching
- **Comprehensive Coverage**: Includes Arweave, AO, AR.IO, HyperBEAM, and more
- **Automatic Updates**: Content updates automatically when source documentation changes
- **Offline Capable**: Optional local sync for development

### **Local Development with Sync**
```bash
# Ensure permaweb-llm-fuel is built first
cd ../permaweb-llm-fuel && bun run build

# Sync fresh data to glossary
cd ../permaweb-glossary
bun run sync        # Sync data only
bun run sync:dev    # Sync + start dev server
```

## 📊 Performance Metrics

| Metric | Before | After | Improvement |
|--------|---------|-------|-------------|
| **Documentation Load Time** | 30-45s | 2-3s | **15x faster** |
| **Network Requests** | 100+ pages | 5 files | **20x fewer** |
| **Initial Bundle Size** | - | Optimized | **Minimal** |
| **Search Response Time** | - | <200ms | **Lightning fast** |

## 🛠️ Development

### **Available Scripts**
```bash
bun dev                    # Start development server
bun run build             # Build for production  
bun run preview           # Preview production build
bun run sync              # Sync LLM data locally
bun run sync:dev          # Sync + start dev server
bun run deploy            # Interactive deployment
bun run deploy:preview    # Fast preview deployment
```

### **Contributing**
The modular architecture makes contributing easier:

- **Search Providers**: Extend `SearchProvider` to add new search capabilities
- **UI Components**: Enhance the Astro components and styles
- **Performance**: Optimize loading and search algorithms
- **Testing**: Add comprehensive test coverage

### **Architecture Benefits**
- **Extensible**: Easy to add new search providers or data sources
- **Maintainable**: Clear separation of concerns with modular components
- **Performant**: Lazy loading and optimized bundling
- **Testable**: Isolated components with clear interfaces

## 🆘 Troubleshooting

### **Common Issues**

1. **Documentation search not working**: 
   - Check browser console for network errors
   - Verify permaweb-llm-fuel URLs are accessible
   - Try the fallback mode (should auto-fallback to glossary)

2. **Slow loading**:
   - Ensure using pre-extracted content mode
   - Check network timeout settings
   - Verify CDN/gateway accessibility

3. **Search results missing**:
   - Check if data files are properly loaded
   - Verify glossary.json format
   - Look for JavaScript errors in console

### **Development Issues**
- Run `bun run sync` to get fresh local data
- Ensure relative paths are correct in sync script
- Verify permaweb-llm-fuel is built before syncing

## 📋 Browser Support

- **Chrome** 88+
- **Firefox** 85+
- **Safari** 14+
- **Edge** 88+

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

We welcome contributions! Please see our [ROADMAP](docs/ROADMAP.md) for current priorities and [BUGS](docs/BUGS.md) for known issues.

---

**🌐 Experience the future of permanent web documentation search at [glossary_tiny4vr.permagate.io](https://glossary_tiny4vr.permagate.io/)**