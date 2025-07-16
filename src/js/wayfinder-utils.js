// Wayfinder SDK utilities for routing Arweave data requests
// Using simplified implementation to avoid Node.js dependency issues in browser builds

// Gateway routing state
let gatewayCache = new Map();
let lastPingTime = 0;
let isInitialized = false;

// Configuration options
const WAYFINDER_CONFIG = {
    // Default gateway configuration
    defaultGateway: 'arweave.net',
    // Fallback gateways in order of preference
    fallbackGateways: [
        'ar-io.net',
        'arweave.dev',
        'arweave.live'
    ],
    // Request timeout in milliseconds
    timeout: 3000,
    // Enable gateway verification
    verifyGateways: false, // Disable to prevent blocking initialization
    // Debug mode
    debug: false,
    // FastestPing routing strategy configuration
    fastestPing: {
        timeoutMs: 300, // Shorter timeout to prevent hanging
        pingPath: '/ar-io/info',
        cacheResultsMs: 30000
    }
};

/**
 * Ping a gateway to measure latency
 * @param {string} gateway - Gateway hostname
 * @param {string} path - Path to ping
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<number>} - Latency in milliseconds, or Infinity if failed
 */
async function pingGateway(gateway, path = '/ar-io/info', timeout = 500) {
    const start = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(`https://${gateway}${path}`, {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-cache'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            return performance.now() - start;
        } else {
            return Infinity;
        }
    } catch (error) {
        clearTimeout(timeoutId);
        // Don't log every failed ping as it's expected
        if (WAYFINDER_CONFIG.debug) {
            console.debug(`Gateway ${gateway} ping failed:`, error.message);
        }
        return Infinity;
    }
}

/**
 * Find the fastest gateway from a list
 * @param {Array<string>} gateways - List of gateway hostnames
 * @param {Object} config - Configuration options
 * @returns {Promise<string>} - Fastest gateway hostname
 */
async function findFastestGateway(gateways, config = {}) {
    const { fastestPing } = { ...WAYFINDER_CONFIG, ...config };
    
    // Check cache first
    const now = Date.now();
    if (gatewayCache.has('fastest') && (now - lastPingTime) < fastestPing.cacheResultsMs) {
        return gatewayCache.get('fastest');
    }
    
    // Ping all gateways concurrently
    const pingPromises = gateways.map(async (gateway) => {
        const latency = await pingGateway(gateway, fastestPing.pingPath, fastestPing.timeoutMs);
        return { gateway, latency };
    });
    
    try {
        // Add timeout to the entire ping operation
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Gateway ping timeout')), 2000)
        );
        
        const results = await Promise.race([
            Promise.all(pingPromises),
            timeoutPromise
        ]);
        
        // Sort by latency and pick the fastest
        results.sort((a, b) => a.latency - b.latency);
        const fastest = results.find(r => r.latency < Infinity)?.gateway || gateways[0];
        
        // Cache the result
        gatewayCache.set('fastest', fastest);
        lastPingTime = now;
        
        if (config.debug) {
            console.log('Gateway ping results:', results);
            console.log('Selected fastest gateway:', fastest);
        }
        
        return fastest;
    } catch (error) {
        if (WAYFINDER_CONFIG.debug) {
            console.warn('Failed to ping gateways, using default:', error);
        }
        return gateways[0];
    }
}

/**
 * Initialize the simplified gateway routing system
 * @param {Object} config - Optional configuration overrides
 * @returns {Promise<void>}
 */
async function initializeWayfinder(config = {}) {
    if (isInitialized) {
        return;
    }

    try {
        const finalConfig = { ...WAYFINDER_CONFIG, ...config };
        
        if (finalConfig.debug) {
            console.log('Wayfinder-compatible gateway routing initialized with config:', finalConfig);
        }
        
        isInitialized = true;
    } catch (error) {
        console.error('Failed to initialize gateway routing:', error);
        isInitialized = false;
    }
}

/**
 * Convert an Arweave HTTPS URL to ar:// schema
 * @param {string} url - The HTTPS URL to convert
 * @returns {string} - The ar:// URL or original URL if not convertible
 */
function convertToArSchema(url) {
    try {
        const urlObj = new URL(url);
        
        // Check if it's an Arweave-related domain
        const arweaveDomains = [
            'arweave.net',
            'ar-io.net', 
            'arweave.dev',
            'arweave.live',
            'docs.ar.io'
        ];
        
        const isArweaveDomain = arweaveDomains.some(domain => 
            urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
        );
        
        if (isArweaveDomain) {
            // Convert https://domain/path to ar://domain/path
            return `ar://${urlObj.hostname}${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
        }
        
        return url;
    } catch (error) {
        // Return original URL if parsing fails
        return url;
    }
}

/**
 * Get the optimal gateway URL for an Arweave transaction ID
 * @param {string} txId - The Arweave transaction ID
 * @returns {Promise<string>} - The optimal gateway URL
 */
async function getOptimalGatewayUrl(txId) {
    if (!isInitialized) {
        await initializeWayfinder();
    }
    
    try {
        // Get all available gateways
        const allGateways = [WAYFINDER_CONFIG.defaultGateway, ...WAYFINDER_CONFIG.fallbackGateways];
        
        // Find the fastest gateway
        const optimalGateway = await findFastestGateway(allGateways);
        
        return `https://${optimalGateway}/${txId}`;
    } catch (error) {
        console.warn('Gateway selection failed, using default:', error);
        return `https://${WAYFINDER_CONFIG.defaultGateway}/${txId}`;
    }
}

/**
 * Route a GraphQL request through optimal gateway
 * @param {string} query - The GraphQL query
 * @param {Object} variables - Optional GraphQL variables
 * @returns {Promise<Response>} - The fetch response
 */
async function routeGraphQLRequest(query, variables = {}) {
    if (!isInitialized) {
        await initializeWayfinder();
    }
    
    try {
        // Get all available gateways
        const allGateways = [WAYFINDER_CONFIG.defaultGateway, ...WAYFINDER_CONFIG.fallbackGateways];
        
        // Find the fastest gateway
        const optimalGateway = await findFastestGateway(allGateways);
        const graphqlUrl = `https://${optimalGateway}/graphql`;
        
        const requestBody = {
            query,
            ...(Object.keys(variables).length > 0 && { variables })
        };
        
        const response = await fetch(graphqlUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(WAYFINDER_CONFIG.timeout)
        });
        
        if (!response.ok) {
            throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
        }
        
        return response;
    } catch (error) {
        // Try fallback gateways if primary fails
        for (const fallbackGateway of WAYFINDER_CONFIG.fallbackGateways) {
            try {
                const fallbackUrl = `https://${fallbackGateway}/graphql`;
                const fallbackResponse = await fetch(fallbackUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(WAYFINDER_CONFIG.timeout)
                });
                
                if (fallbackResponse.ok) {
                    console.log(`GraphQL request succeeded via fallback gateway: ${fallbackGateway}`);
                    return fallbackResponse;
                }
            } catch (fallbackError) {
                console.warn(`Fallback gateway ${fallbackGateway} also failed:`, fallbackError);
            }
        }
        
        throw error;
    }
}

/**
 * Get multiple gateway URLs for a transaction (for link options)
 * @param {string} txId - The Arweave transaction ID
 * @returns {Promise<Object>} - Object with primary and alternative gateway URLs
 */
async function getGatewayUrls(txId) {
    const primaryUrl = await getOptimalGatewayUrl(txId);
    
    // Provide alternative gateways for user choice
    const alternatives = WAYFINDER_CONFIG.fallbackGateways.map(gateway => ({
        name: gateway,
        url: `https://${gateway}/${txId}`
    }));
    
    return {
        primary: {
            name: 'Optimal Gateway',
            url: primaryUrl
        },
        alternatives
    };
}

/**
 * Check if gateway routing is available and initialized
 * @returns {boolean} - True if gateway routing is available
 */
function isWayfinderAvailable() {
    return isInitialized;
}

/**
 * Process a docs URL to use ar:// schema if applicable
 * @param {string} url - The documentation URL
 * @returns {string} - The processed URL
 */
function processDocsUrl(url) {
    // Convert permaweb links to ar:// schema
    const converted = convertToArSchema(url);
    
    // If it was converted to ar:// schema, return as-is
    if (converted.startsWith('ar://')) {
        return converted;
    }
    
    // For other URLs, return unchanged
    return url;
}

// Export functions for use in other modules
export {
    initializeWayfinder,
    convertToArSchema,
    getOptimalGatewayUrl,
    routeGraphQLRequest,
    getGatewayUrls,
    isWayfinderAvailable,
    processDocsUrl,
    WAYFINDER_CONFIG
};