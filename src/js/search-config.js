export const searchConfig = {
  timeouts: {
    initialization: 5000,
    search: 3000,
    indexLoad: 10000
  },
  fallback: {
    enabled: true,
    provider: 'basic'
  },
  features: {
    documentationSearch: true,
    glossarySearch: true
  }
}; 