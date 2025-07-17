/**
 * Configuration for Permaweb LLM Fuel integration
 * Centralizes URLs and settings for accessing pre-extracted documentation content
 */

// Environment detection
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isPreview = window.location.hostname.includes('preview');

// Base URLs for different environments
const PERMAWEB_LLM_FUEL_URLS = {
    production: 'https://fuel_permawebllms.arweave.net',
    preview: 'https://preview-llm.vercel.app', // Adjust if different
    local: 'http://localhost:4321', // Default permaweb-llm-fuel dev server
    fallback: 'https://raw.githubusercontent.com/dpshade/permaweb-llm-fuel/main/public'
};

// Automatically select the appropriate base URL
function getBaseUrl() {
    if (isLocal) {
        return PERMAWEB_LLM_FUEL_URLS.local;
    } else if (isPreview) {
        return PERMAWEB_LLM_FUEL_URLS.preview;
    } else {
        return PERMAWEB_LLM_FUEL_URLS.production;
    }
}

// Cache for dynamically loaded site data
let _availableSitesCache = null;
let _siteDiscoveryPromise = null;

export const permawebConfig = {
    // URLs for documentation index
    docsIndex: {
        primary: `${getBaseUrl()}/docs-index.json`,
        fallback: `${PERMAWEB_LLM_FUEL_URLS.fallback}/docs-index.json`
    },

    // Network configuration
    network: {
        timeout: 5000,
        retries: 2,
        userAgent: 'Permaweb-Glossary/1.0'
    },

    // Content limits
    content: {
        maxLength: 5000, // Max characters per page content
        snippetLength: 150 // Max snippet length for search results
    },

    // Feature flags
    features: {
        usePreExtractedContent: true, // Use pre-extracted content from LLM text files
        useDynamicSiteDiscovery: true // Enable dynamic site discovery from docs-index.json
    }
};

/**
 * Fetch with timeout and error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
    const { timeout = permawebConfig.network.timeout, ...fetchOptions } = options;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Dynamically discover available sites from docs-index.json
 * @returns {Promise<Array<string>>} Array of site keys
 */
async function discoverAvailableSites() {
    // Return cached result if available
    if (_availableSitesCache !== null) {
        return _availableSitesCache;
    }
    
    // Return existing promise if discovery is in progress
    if (_siteDiscoveryPromise !== null) {
        return _siteDiscoveryPromise;
    }
    
    // Start new discovery process
    _siteDiscoveryPromise = (async () => {
        try {
            const indexUrls = getDocsIndexUrls();
            
            let response;
            let docsIndex;
            
            try {
                response = await fetchWithTimeout(indexUrls.primary, {
                    headers: { 'User-Agent': permawebConfig.network.userAgent }
                });
                if (!response.ok) throw new Error(`Primary source failed: ${response.status}`);
                docsIndex = await response.json();
            } catch (primaryError) {
                response = await fetchWithTimeout(indexUrls.fallback, {
                    headers: { 'User-Agent': permawebConfig.network.userAgent }
                });
                if (!response.ok) throw new Error(`Fallback source also failed: ${response.status}`);
                docsIndex = await response.json();
            }
            
            // Extract site keys from docs index
            const sites = docsIndex.sites || {};
            const siteKeys = Object.keys(sites);
            
            // Cache the result
            _availableSitesCache = siteKeys;
            return siteKeys;
            
        } catch (error) {
            // Fallback to known sites if discovery fails
            const fallbackSites = ['hyperbeam', 'ao', 'ario', 'arweave', 'permaweb-glossary'];
            _availableSitesCache = fallbackSites;
            return fallbackSites;
        } finally {
            // Clear the promise so future calls can retry if needed
            _siteDiscoveryPromise = null;
        }
    })();
    
    return _siteDiscoveryPromise;
}

/**
 * Generate LLM text file URLs for a site key using pattern
 * @param {string} siteKey - Site identifier
 * @returns {Object} Primary and fallback URLs
 */
function generateLLMTextFileUrls(siteKey) {
    const baseUrl = getBaseUrl();
    const fallbackUrl = PERMAWEB_LLM_FUEL_URLS.fallback;
    
    return {
        primary: `${baseUrl}/${siteKey}-llms.txt`,
        fallback: `${fallbackUrl}/${siteKey}-llms.txt`
    };
}

/**
 * Get URLs for all LLM text files (dynamically discovered)
 * @returns {Promise<Object>} Map of site keys to URL objects
 */
export async function getLLMTextFileUrls() {
    // Check if dynamic discovery is enabled
    if (!permawebConfig.features.useDynamicSiteDiscovery) {
        // Return static configuration for backward compatibility
        return getStaticLLMTextFileUrls();
    }
    
    try {
        const availableSites = await discoverAvailableSites();
        const llmTextUrls = {};
        
        for (const siteKey of availableSites) {
            llmTextUrls[siteKey] = generateLLMTextFileUrls(siteKey);
        }
        
        return llmTextUrls;
        
    } catch (error) {
        return getStaticLLMTextFileUrls();
    }
}

/**
 * Static LLM text file URLs (fallback/backward compatibility)
 * @returns {Object} Map of site keys to URL objects
 */
function getStaticLLMTextFileUrls() {
    const baseUrl = getBaseUrl();
    const fallbackUrl = PERMAWEB_LLM_FUEL_URLS.fallback;
    
    return {
        hyperbeam: {
            primary: `${baseUrl}/hyperbeam-llms.txt`,
            fallback: `${fallbackUrl}/hyperbeam-llms.txt`
        },
        ao: {
            primary: `${baseUrl}/ao-llms.txt`,
            fallback: `${fallbackUrl}/ao-llms.txt`
        },
        ario: {
            primary: `${baseUrl}/ario-llms.txt`,
            fallback: `${fallbackUrl}/ario-llms.txt`
        },
        arweave: {
            primary: `${baseUrl}/arweave-llms.txt`,
            fallback: `${fallbackUrl}/arweave-llms.txt`
        },
        'permaweb-glossary': {
            primary: `${baseUrl}/permaweb-glossary-llms.txt`,
            fallback: `${fallbackUrl}/permaweb-glossary-llms.txt`
        }
    };
}

/**
 * Get the appropriate docs index URL
 * @returns {Object} Primary and fallback URLs
 */
export function getDocsIndexUrls() {
    const urls = permawebConfig.docsIndex;
    
    return {
        primary: urls.primary,
        fallback: urls.fallback
    };
}

/**
 * Check if we should use pre-extracted content
 * @returns {boolean}
 */
export function shouldUsePreExtractedContent() {
    return permawebConfig.features.usePreExtractedContent;
}

/**
 * Get current environment name
 * @returns {string}
 */
export function getCurrentEnvironment() {
    if (isLocal) return 'local';
    if (isPreview) return 'preview';
    return 'production';
}

export default permawebConfig; 