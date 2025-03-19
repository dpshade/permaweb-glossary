const CACHE_NAME = 'permaweb-glossary-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/define.html',
    '/src/css/style.css',
    '/src/js/main.js',
    '/src/js/keyboard-nav.js',
    '/src/data/glossary.json',
    '/assets/favicons/favicon.ico',
    '/assets/favicons/favicon.svg',
    '/assets/favicons/apple-touch-icon.png',
    '/assets/favicons/site.webmanifest'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Ensure new service worker activates immediately
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(STATIC_ASSETS);
            })
            .catch(error => {
                console.error('Service worker cache installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    // Take control of all clients immediately
    event.waitUntil(
        clients.claim()
            .then(() => {
                return caches.keys().then((cacheNames) => {
                    return Promise.all(
                        cacheNames.map((cacheName) => {
                            if (cacheName !== CACHE_NAME) {
                                return caches.delete(cacheName);
                            }
                        })
                    );
                });
            })
    );
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Handle API requests (like Arweave GraphQL)
    if (event.request.url.includes('arweave-search.goldsky.com')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return new Response('Offline - API request failed', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: new Headers({
                            'Content-Type': 'text/plain'
                        })
                    });
                })
        );
        return;
    }

    // Handle static assets with cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached response if found
                if (response) {
                    return response;
                }

                // Clone the request because it can only be used once
                const fetchRequest = event.request.clone();

                // Make network request and cache the response
                return fetch(fetchRequest).then((response) => {
                    // Check if we received a valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone the response because it can only be used once
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
    );
}); 