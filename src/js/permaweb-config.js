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

export const permawebConfig = {
    // URLs for documentation index
    docsIndex: {
        primary: `${getBaseUrl()}/docs-index.json`,
        fallback: `${PERMAWEB_LLM_FUEL_URLS.fallback}/docs-index.json`,
        enhanced: `${getBaseUrl()}/enhanced-docs-index.json` // If using sync script
    },

    // URLs for LLM text files with pre-extracted content
    llmTextFiles: {
        hyperbeam: {
            primary: `${getBaseUrl()}/hyperbeam-llms.txt`,
            fallback: `${PERMAWEB_LLM_FUEL_URLS.fallback}/hyperbeam-llms.txt`
        },
        ao: {
            primary: `${getBaseUrl()}/ao-llms.txt`,
            fallback: `${PERMAWEB_LLM_FUEL_URLS.fallback}/ao-llms.txt`
        },
        ario: {
            primary: `${getBaseUrl()}/ario-llms.txt`,
            fallback: `${PERMAWEB_LLM_FUEL_URLS.fallback}/ario-llms.txt`
        },
        arweave: {
            primary: `${getBaseUrl()}/arweave-llms.txt`,
            fallback: `${PERMAWEB_LLM_FUEL_URLS.fallback}/arweave-llms.txt`
        },
        'permaweb-glossary': {
            primary: `${getBaseUrl()}/permaweb-glossary-llms.txt`,
            fallback: `${PERMAWEB_LLM_FUEL_URLS.fallback}/permaweb-glossary-llms.txt`
        }
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
        usePreExtractedContent: true, // Use LLM text files instead of fetching pages
        fallbackToLive: false, // Fallback to live page fetching if LLM files fail
        cacheResults: true, // Cache LLM text file contents
        enableQualityScoring: true // Use quality scores from LLM extraction
    },

    // Debug settings
    debug: {
        enabled: isLocal, // Enable debug logging in local environment
        logNetworkRequests: isLocal,
        logContentParsing: false,
        logSearchPerformance: false
    }
};

/**
 * Get URLs for all LLM text files
 * @returns {Object} Map of site keys to URL objects
 */
export function getLLMTextFileUrls() {
    return permawebConfig.llmTextFiles;
}

/**
 * Get the appropriate docs index URL
 * @param {boolean} useEnhanced - Whether to use enhanced index if available
 * @returns {Object} Primary and fallback URLs
 */
export function getDocsIndexUrls(useEnhanced = false) {
    const urls = permawebConfig.docsIndex;
    
    if (useEnhanced) {
        return {
            primary: urls.enhanced,
            fallback: urls.primary // Fallback to regular index if enhanced not available
        };
    }
    
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
 * Log debug message if debugging is enabled
 * @param {string} category - Debug category
 * @param {...any} args - Arguments to log
 */
export function debugLog(category, ...args) {
    if (permawebConfig.debug.enabled) {
        const categoryMap = {
            network: permawebConfig.debug.logNetworkRequests,
            content: permawebConfig.debug.logContentParsing,
            search: permawebConfig.debug.logSearchPerformance
        };
        
        if (categoryMap[category] !== false) {
            console.log(`[Permaweb-${category}]`, ...args);
        }
    }
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