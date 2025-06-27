# Permaweb Glossary Search

A lightweight client-side search implementation for the Permaweb Glossary. This application runs entirely in the browser using pure JavaScript, HTML, and CSS, with the `FlexSearch` library for fast and efficient search capabilities.

## Features

- 🔍 Fuzzy search - find relevant terms even with typos or partial matches
- 🌐 Fully client-side - no server-side processing required
- ⚡ Fast search with debouncing for optimal performance
- 📱 Responsive design for mobile and desktop devices
- 🏷️ Displays categories and related terms for better context
- ⌨️ Keyboard navigation support with arrow keys

## Project Structure

```
permaweb-glossary-search/
├── public/               # Public-facing files
│   └── index.html        # Main HTML entry point
├── src/                  # Source code
│   ├── css/              # Stylesheets
│   │   └── style.css     # Main stylesheet
│   ├── js/               # JavaScript files
│   │   ├── main.js       # Main application logic
│   │   └── keyboard-nav.js # Keyboard navigation functionality
│   └── data/             # Data files
│       └── glossary.json # Glossary data
├── server.js             # Development server
├── package.json          # Project configuration
└── README.md             # Project documentation
```

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- [Bun](https://bun.sh/) for local development (optional)

### Running Locally

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd permaweb-glossary-search
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Start the development server:
   ```bash
   bun dev
   ```

4. Open your browser and navigate to `http://localhost:3000`.

## Building for Production

To create a production build:

```bash
bun run build
```

This will create a `dist` directory with all the necessary files for deployment.

### Build Process

The build system has been streamlined for simplicity and maintainability:

1. **Clean**: Removes previous build artifacts
2. **Copy**: Copies static assets from `public/` and source files
3. **Minify**: Bundles and minifies JavaScript/CSS using Bun's built-in bundler
4. **Post-process**: Runs optimizations including:
   - Generates `glossary.txt` from `glossary.json` 
   - Minifies JSON data
   - Compresses all assets with gzip

### Available Scripts

- `bun run dev` - Development server with hot reload
- `bun run build` - Production build
- `bun run preview` - Preview production build locally
- `bun run clean` - Clean build artifacts
- `bun run deploy` - Deploy to Arweave (local)
- `bun run deploy:preview` - Create preview deployment

## Deployment

### Automated Deployment via GitHub Actions

The project uses GitHub Actions for automated deployments:

#### **Production Deployment** 
- **Trigger**: Push to `main` branch
- **URL**: https://glossary.ar.io
- **ArNS**: `glossary` (main domain)

#### **Preview Deployment**
- **Trigger**: Push to `preview` branch  
- **URL**: https://preview_glossary.ar.io
- **ArNS**: `glossary` with `preview` undername

#### **Pull Request Checks**
- **Trigger**: Pull requests to `main`
- **Action**: Build verification only (no deployment)

### Creating Preview Deployments

To create a preview deployment from any branch:

```bash
# Using the npm script (recommended)
bun run deploy:preview

# Or using the script directly
./scripts/create-preview.sh

# Or manually
git push origin HEAD:preview --force-with-lease
```

The script will:
1. Check for uncommitted changes
2. Push your current branch to the `preview` branch
3. Trigger the GitHub Actions workflow
4. Deploy to `https://preview_glossary.ar.io`

### Manual Deployment

For local manual deployment:

```bash
bun run build
bun run deploy
```

## How It Works

1. The application uses FlexSearch, a lightweight full-text search library with fuzzy matching capabilities.
2. During initialization, the application:
   - Fetches the glossary data from `src/data/glossary.json`
   - Creates a FlexSearch index with the glossary terms, definitions, and metadata
   - Builds a context map to enhance search relevance with related terms
3. When you type a search query:
   - The application generates variations of your query to handle typos and related forms
   - Searches across all fields (term, definition, aliases)
   - Calculates relevance scores based on exact matches, partial matches, and context
   - Displays the most relevant results sorted by score

## Customizing the Glossary

Edit the `src/data/glossary.json` file to add, modify, or remove terms. The JSON structure is as follows:

```json
[
  {
    "term": "Term name",
    "definition": "Term definition",
    "category": "Category name",
    "related": ["Related term 1", "Related term 2"],
    "aliases": ["alias1", "alias2"],
    "docs": ["https://documentation-link.com"]
  }
]
```

## Embedding in Other Sites

1. Build the project:
   ```bash
   bun run build
   ```

2. Place the contents of the `dist` directory on your web server.

3. Add an iframe to your site:
   ```html
   <div class="glossary-search">
     <iframe src="https://glossary_tiny4vr.permagate.io/" width="100%" height="600px" frameborder="0"></iframe>
   </div>
   ```

## Color Customization

The glossary supports extensive color customization through URL parameters. This is especially useful when embedding the glossary in different websites with varying color schemes.

### Basic Color Parameters

Add these parameters to the iframe URL to customize the colors:

```
?bg-color=%23121212&text-color=%23e0e0e0&link-color=%238ab4f8
```

Note: Color values must be URL-encoded (e.g., `#` becomes `%23`).

### Available Color Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `bg-color` | Background color | `#ffffff` |
| `text-color` | Main text color | `#111111` |
| `link-color` | Hyperlink color | `#3498db` |
| `border-color` | Border color | `#000000` |
| `hover-bg` | Background color on hover | `#f0f0f0` |
| `category-bg` | Category badge background | `#f0f0f0` |
| `category-text` | Category badge text | `#555555` |
| `input-bg` | Search input background | Same as `bg-color` |
| `result-bg` | Search results background | Same as `bg-color` |
| `result-hover` | Search results hover background | Same as `hover-bg` |
| `heading-color` | Heading text color | Same as `text-color` |
| `tag-bg` | Related tag background | Same as `border-color` |
| `tag-text` | Related tag text | Same as `bg-color` |
| `button-bg` | Button background | Same as `border-color` |
| `button-text` | Button text | Same as `bg-color` |
| `accent-color` | Accent color for highlights | `#4a90e2` |
| `secondary-text` | Secondary text color | `#666666` |

### UI Visibility Parameters

In addition to color customization, you can control UI elements visibility:

| Parameter | Description | Values | Default |
|-----------|-------------|--------|---------|
| `hide-header` | Hide the glossary header | `true`, `1`, or `false` | `false` |
| `translucent` | Make background translucent | `true`, `1`, or a value between 0-1 for opacity | Not applied |

Example with UI parameters:
```
?hide-header=true&translucent=0.8&bg-color=%23121212
```

### Example Color Schemes

#### Dark Mode
```
?bg-color=%23121212&text-color=%23e0e0e0&link-color=%238ab4f8&border-color=%23333333&hover-bg=%23222222&heading-color=%23ffffff
```

#### High Contrast
```
?bg-color=%23000000&text-color=%23ffffff&link-color=%23ffff00&border-color=%23ffffff&heading-color=%23ffff00
```

#### Solarized Dark
```
?bg-color=%23002b36&text-color=%23839496&link-color=%23268bd2&heading-color=%23b58900
```

#### GitHub-inspired
```
?bg-color=%230d1117&text-color=%23c9d1d9&link-color=%2358a6ff&tag-bg=%23238636&heading-color=%23f0f6fc
```

## Performance Considerations

- The application loads quickly as it uses a lightweight search library
- The search responds immediately as you type
- For larger glossaries (hundreds of terms), the application remains performant

## License

MIT

## Credits

- [FlexSearch](https://github.com/nextapps-de/flexsearch) - For the fast and fuzzy search capabilities