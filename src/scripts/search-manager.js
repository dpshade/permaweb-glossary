import { searchConfig } from './search-config.js';
import { SearchState } from './search-state.js';

export class SearchManager {
  constructor() {
    this.searchProviders = new Map();
    this.state = new SearchState();
    this.activeProvider = null;

    this.state.subscribe(this.onStateChange.bind(this));
  }

  registerProvider(name, provider) {
    this.searchProviders.set(name, provider);
  }

  async initialize(defaultMode = 'basic') {
    this.state.setState({ isInitialized: false });
    
    const provider = this.searchProviders.get(defaultMode);
    if (!provider) {
      throw new Error(`Provider ${defaultMode} not registered.`);
    }

    this.activeProvider = provider;
    try {
        const initResult = await this.activeProvider.initialize();
        
        // Check if initialization actually succeeded
        if (initResult === false) {
            throw new Error(`Provider ${defaultMode} initialization returned false`);
        }
        
        this.state.setState({ isInitialized: true, mode: defaultMode });
    } catch (error) {
        console.error(`Failed to initialize default provider ${defaultMode}.`, error);
        
        // If we failed to initialize the enhanced provider, fall back to basic
        if (defaultMode !== 'basic') {
            console.log('Falling back to basic provider...');
            
            // Destroy the failed provider
            if (this.activeProvider) {
                this.activeProvider.destroy();
            }
            
            // Switch to basic provider
            const fallbackProvider = this.searchProviders.get('basic');
            this.activeProvider = fallbackProvider;
            
            try {
                await this.activeProvider.initialize();
                this.state.setState({ isInitialized: true, mode: 'basic' });
            } catch (fallbackError) {
                console.error('Even basic provider failed:', fallbackError);
                this.state.setState({ isInitialized: false });
                throw fallbackError;
            }
        } else {
            // Basic provider failed, nothing else to try
            this.state.setState({ isInitialized: false });
            throw error;
        }
    }
  }

  async switchMode(mode) {
    if (this.state.mode === mode || !this.searchProviders.has(mode)) {
      return;
    }

    if (this.activeProvider) {
      this.activeProvider.destroy();
    }

    const newProvider = this.searchProviders.get(mode);
    this.activeProvider = newProvider;
    this.state.setState({ isInitialized: false, mode: mode, currentResults: [] });

    try {
        const initResult = await this.activeProvider.initialize();
        
        // Check if initialization actually succeeded
        if (initResult === false) {
            throw new Error(`Provider ${mode} initialization returned false`);
        }
        
        this.state.setState({ isInitialized: true });
    } catch (error) {
        console.error(`Failed to switch to mode '${mode}'. Falling back to basic search.`, error);
        
        // Destroy the failed provider
        this.activeProvider.destroy();

        // Switch to the fallback provider
        const fallbackProvider = this.searchProviders.get(searchConfig.fallback.provider);
        this.activeProvider = fallbackProvider;
        
        // We assume the basic provider is already initialized and won't fail.
        // If it wasn't, we should initialize it.
        if (!this.state.isInitialized) {
            await this.activeProvider.initialize();
        }
        
        this.state.setState({ 
            mode: searchConfig.fallback.provider, 
            isInitialized: true 
        });
    }
  }

  async performSearch(query) {
    if (!this.state.isInitialized || !this.activeProvider) {
        console.warn('Search manager not initialized or no active provider.');
        return;
    }
    const results = await this.activeProvider.search(query);
    this.state.setState({ currentResults: results });
  }

  onStateChange(newState) {
    // This is where we can trigger UI updates later
    console.log('Search state changed:', newState);
  }
} 