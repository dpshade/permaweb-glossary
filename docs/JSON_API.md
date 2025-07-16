# Pure Client-side JSON API

The Permaweb Glossary provides a pure client-side JSON API implemented using Service Workers. This API intercepts `/json` requests and returns JSON responses without any server-side processing.

## Endpoint

```
GET /json
```

**Note**: This endpoint is handled entirely by a Service Worker - no server-side code involved!

## Parameters

### Required Parameters

- **q** (string): The search query
- **mode** (string): The search mode
  - `basic` or `glossary` - Search glossary terms
  - `enhanced` or `docs` - Search documentation

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "query": "arweave",
  "mode": "basic",
  "results": [
    {
      "term": "Arweave",
      "definition": "A blockchain network for permanent data storage...",
      "category": "Protocol",
      "score": 2.0,
      "related": ["permaweb", "blockweave"]
    }
  ],
  "total": 1,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Error Response (4xx/5xx)

```json
{
  "success": false,
  "error": "Missing required parameter: q",
  "message": "Additional error details",
  "query": "test-query",
  "mode": "basic",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Usage Examples

### Basic Glossary Search

```bash
curl "https://your-domain.com/json?q=arweave&mode=basic"
```

### Documentation Search

```bash
curl "https://your-domain.com/json?q=transaction&mode=docs"
```

### Direct HTTP Requests

```bash
# Basic glossary search
curl "http://localhost:4321/json?q=arweave&mode=basic"

# Documentation search  
curl "http://localhost:4321/json?q=transaction&mode=docs"

# Glossary search (alternative mode name)
curl "http://localhost:4321/json?q=permaweb&mode=glossary"
```

### JavaScript Fetch Example

```javascript
async function searchAPI(query, mode) {
  const response = await fetch(`/json?q=${encodeURIComponent(query)}&mode=${mode}`);
  const data = await response.json();
  return data;
}

// Usage
const results = await searchAPI('arweave', 'basic');
console.log(`Found ${results.total} results`);
```

### Global SearchManager Access

```javascript
// Access the underlying search manager directly (if needed)
const results = await window.searchManager.performSearch('arweave');
console.log(window.searchManager.state.currentResults);
```

### Fetch-based Example

```javascript
async function searchGlossary(query, mode = 'basic') {
  try {
    const response = await fetch(`/json?q=${encodeURIComponent(query)}&mode=${mode}`);
    const data = await response.json();
    
    if (data.success) {
      console.log(`Found ${data.total} results for "${data.query}"`);
      return data.results;
    } else {
      console.error('Search error:', data.error);
      return [];
    }
  } catch (error) {
    console.error('Request failed:', error);
    return [];
  }
}

// Search glossary terms
const glossaryResults = await searchGlossary('permaweb', 'glossary');

// Search documentation
const docsResults = await searchGlossary('consensus', 'docs');
```

## Error Codes

- **400 Bad Request**: Missing or invalid parameters
- **500 Internal Server Error**: Search provider initialization or execution error

## CORS Headers

The endpoint includes CORS headers for cross-origin requests:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
Access-Control-Allow-Headers: Content-Type
```

## Rate Limiting

Currently no rate limiting is implemented. Consider implementing rate limiting for production use.

## Response Fields

### Success Response Fields

- **success** (boolean): Always `true` for successful responses
- **query** (string): The search query that was executed
- **mode** (string): The search mode used (`basic` or `enhanced`)
- **results** (array): Array of search results
- **total** (number): Number of results returned
- **timestamp** (string): ISO 8601 timestamp of when the search was executed

### Result Object Fields (varies by mode)

#### Glossary Mode (`basic`)
- **term** (string): The glossary term
- **definition** (string): Term definition
- **category** (string): Term category
- **score** (number): Relevance score
- **related** (array): Related terms
- **aliases** (array): Alternative names for the term

#### Documentation Mode (`enhanced`)
- **title** (string): Document title
- **content** (string): Document content snippet
- **url** (string): Document URL
- **siteName** (string): Source site name
- **score** (number): Relevance score
- **snippet** (string): Generated content snippet

## Architecture

### How It Works

1. **Service Worker Interception**: The service worker intercepts all requests to `/json`
2. **Parameter Validation**: Query parameters (`q` and `mode`) are validated
3. **Message Passing**: Service worker sends search request to main page via `postMessage`
4. **Search Execution**: Main page performs search using existing search providers
5. **JSON Response**: Service worker returns formatted JSON with proper headers

### Technical Details

- **No Server-Side Code**: Everything runs in the browser
- **Real-time Search**: Uses the same search providers as the main UI
- **Proper HTTP Headers**: Returns `application/json` content type
- **Error Handling**: Comprehensive error responses for all failure cases
- **CORS Support**: Includes CORS headers for cross-origin requests

### Global Objects

```javascript
// Access search manager (available after page load)
window.searchManager.state.mode        // Current search mode
window.searchManager.state.isInitialized // Ready status
window.searchManager.performSearch(query) // Perform search
```

## Testing

Test the pure client-side JSON API:

```bash
# 1. Start the development server
bun run dev

# 2. Visit main page first to initialize service worker
open http://localhost:4321/

# 3. Test JSON endpoints (returns pure JSON)
curl "http://localhost:4321/json?q=arweave&mode=basic"
curl "http://localhost:4321/json?q=permaweb&mode=glossary"  
curl "http://localhost:4321/json?q=transaction&mode=docs"

# 4. Test error cases
curl "http://localhost:4321/json" # Missing parameters
curl "http://localhost:4321/json?q=test" # Missing mode
curl "http://localhost:4321/json?q=test&mode=invalid" # Invalid mode
```

### Browser Console Testing

```javascript
// Test via fetch (after visiting main page)
const response = await fetch('/json?q=arweave&mode=basic');
const data = await response.json();
console.log(data);

// Direct access to search manager
await window.searchManager.performSearch('arweave');
console.log(window.searchManager.state.currentResults);
``` 