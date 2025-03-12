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
     <iframe src="path/to/dist/index.html" width="100%" height="600px" frameborder="0"></iframe>
   </div>
   ```

## Performance Considerations

- The application loads quickly as it uses a lightweight search library
- The search responds immediately as you type
- For larger glossaries (hundreds of terms), the application remains performant

## License

MIT

## Credits

- [FlexSearch](https://github.com/nextapps-de/flexsearch) - For the fast and fuzzy search capabilities 