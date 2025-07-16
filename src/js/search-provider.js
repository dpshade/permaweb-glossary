export class SearchProvider {
  async initialize() {
    throw new Error('Must implement');
  }

  async search(query) {
    throw new Error('Must implement');
  }

  destroy() {
    throw new Error('Must implement');
  }
} 