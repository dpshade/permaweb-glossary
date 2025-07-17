import { searchConfig } from './search-config.js';
import { SearchState } from './search-state.js';

export class SearchManager {
  constructor() {
    this.searchProviders = new Map();
    this.state = new SearchState();
    this.activeProvider = null;
    this.providerStatus = new Map(); // Track status of each provider

    this.state.subscribe(this.onStateChange.bind(this));
  }

  registerProvider(name, provider) {
    this.searchProviders.set(name, provider);
    this.providerStatus.set(name, { isInitialized: false, error: null });
  }

  async initialize(defaultMode = 'glossary') {
    this.state.setState({ isInitialized: false });
    
    const provider = this.searchProviders.get(defaultMode);
    if (!provider) {
      throw new Error(`Provider ${defaultMode} not registered.`);
    }

    this.activeProvider = provider;
    try {
        console.log(`Initializing ${defaultMode} search provider...`);
        const initResult = await this.activeProvider.initialize();
        
        // Update provider status
        this.providerStatus.set(defaultMode, { 
            isInitialized: initResult, 
            error: initResult ? null : 'Initialization failed'
        });
        
        // Check if initialization actually succeeded
        if (initResult === false) {
            throw new Error(`Provider ${defaultMode} initialization returned false`);
        }
        
        this.state.setState({ isInitialized: true, mode: defaultMode });
        console.log(`${defaultMode} search provider initialized successfully`);
        
    } catch (error) {
        console.error(`Failed to initialize default provider ${defaultMode}.`, error);
        
        // Update provider status with error
        this.providerStatus.set(defaultMode, { 
            isInitialized: false, 
            error: error.message 
        });
        
        // If we failed to initialize the documentation provider, fall back to glossary
        if (defaultMode !== 'glossary') {
            console.log('Falling back to glossary provider...');
            
            // Destroy the failed provider
            if (this.activeProvider && this.activeProvider.destroy) {
                this.activeProvider.destroy();
            }
            
            // Switch to glossary provider
            const fallbackProvider = this.searchProviders.get('glossary');
            if (!fallbackProvider) {
                throw new Error('Glossary provider not available for fallback');
            }
            
            this.activeProvider = fallbackProvider;
            
            try {
                console.log('Initializing glossary fallback provider...');
                const fallbackResult = await this.activeProvider.initialize();
                
                this.providerStatus.set('glossary', { 
                    isInitialized: fallbackResult, 
                    error: fallbackResult ? null : 'Fallback initialization failed'
                });
                
                if (fallbackResult === false) {
                    throw new Error('Glossary provider initialization returned false');
                }
                
                this.state.setState({ isInitialized: true, mode: 'glossary' });
                console.log('Glossary fallback provider initialized successfully');
                
            } catch (fallbackError) {
                console.error('Even glossary provider failed:', fallbackError);
                this.providerStatus.set('glossary', { 
                    isInitialized: false, 
                    error: fallbackError.message 
                });
                this.state.setState({ isInitialized: false });
                throw fallbackError;
            }
        } else {
            // Glossary provider failed, nothing else to try
            this.state.setState({ isInitialized: false });
            throw error;
        }
    }
  }

  async switchMode(mode, query = null) {
    if (this.state.mode === mode || !this.searchProviders.has(mode)) {
      return;
    }

    console.log(`Switching search mode from ${this.state.mode} to ${mode}...`);

    if (this.activeProvider && this.activeProvider.destroy) {
      this.activeProvider.destroy();
    }

    const newProvider = this.searchProviders.get(mode);
    this.activeProvider = newProvider;
    this.state.setState({ isInitialized: false, mode: mode, currentResults: [] });

    try {
        console.log(`Initializing ${mode} provider...`);
        const initResult = await this.activeProvider.initialize();
        
        // Update provider status
        this.providerStatus.set(mode, { 
            isInitialized: initResult, 
            error: initResult ? null : 'Initialization failed'
        });
        
        // Check if initialization actually succeeded
        if (initResult === false) {
            throw new Error(`Provider ${mode} initialization returned false`);
        }
        
        this.state.setState({ isInitialized: true });
        console.log(`${mode} provider initialized successfully`);
        
        // Auto-perform search if query provided
        if (query && query.trim()) {
            console.log(`Auto-performing search for: "${query}"`);
            await this.performSearch(query);
        }
        
    } catch (error) {
        console.error(`Failed to switch to mode '${mode}'. Falling back to glossary search.`, error);
        
        // Update provider status with error
        this.providerStatus.set(mode, { 
            isInitialized: false, 
            error: error.message 
        });
        
        // Destroy the failed provider
        if (this.activeProvider && this.activeProvider.destroy) {
            this.activeProvider.destroy();
        }

        // Switch to the fallback provider
        const fallbackProvider = this.searchProviders.get(searchConfig.fallback.provider);
        if (!fallbackProvider) {
            throw new Error(`Fallback provider ${searchConfig.fallback.provider} not available`);
        }
        
        this.activeProvider = fallbackProvider;
        
        // We assume the glossary provider is already initialized and won't fail.
        // If it wasn't, we should initialize it.
        if (!this.state.isInitialized) {
            console.log('Initializing fallback provider...');
            const fallbackResult = await this.activeProvider.initialize();
            
            this.providerStatus.set(searchConfig.fallback.provider, { 
                isInitialized: fallbackResult, 
                error: fallbackResult ? null : 'Fallback initialization failed'
            });
            
            if (fallbackResult === false) {
                throw new Error('Fallback provider initialization returned false');
            }
        }
        
        this.state.setState({ 
            mode: searchConfig.fallback.provider, 
            isInitialized: true 
        });
        
        console.log(`Successfully switched to fallback provider: ${searchConfig.fallback.provider}`);
        
        // Auto-perform search with fallback provider if query provided
        if (query && query.trim()) {
            console.log(`Auto-performing search with fallback provider for: "${query}"`);
            await this.performSearch(query);
        }
    }
  }

  async performSearch(query) {
    if (!this.state.isInitialized || !this.activeProvider) {
        console.warn('Search manager not initialized or no active provider.');
        return;
    }
    
    try {
        const results = await this.activeProvider.search(query);
        this.state.setState({ currentResults: results });
    } catch (error) {
        console.error('Search execution failed:', error);
        // Set error result in state
        this.state.setState({ 
            currentResults: [{
                url: '#search-error',
                title: 'Search Error',
                content: 'An error occurred while performing the search. Please try again.',
                fullContent: 'An error occurred while performing the search. Please try again.',
                siteName: 'System',
                score: 0,
                snippet: 'An error occurred while performing the search. Please try again.',
                isError: true
            }]
        });
    }
  }

  onStateChange(newState) {
    // This is where we can trigger UI updates later
    console.log('Search state changed:', newState);
  }

  // Public method to get provider status information
  getProviderStatus(providerName = null) {
    if (providerName) {
      return this.providerStatus.get(providerName) || { isInitialized: false, error: 'Provider not found' };
    }
    
    // Return status for all providers
    const allStatus = {};
    for (const [name, provider] of this.searchProviders) {
      allStatus[name] = this.providerStatus.get(name) || { isInitialized: false, error: 'Status unknown' };
      
      // If provider has a getStatus method, use it for more detailed info
      if (provider && typeof provider.getStatus === 'function') {
        const detailedStatus = provider.getStatus();
        allStatus[name] = { ...allStatus[name], ...detailedStatus };
      }
    }
    
    return allStatus;
  }

  // Public method to get current active provider info
  getActiveProviderInfo() {
    if (!this.activeProvider) {
      return { name: null, status: 'No active provider' };
    }
    
    const currentMode = this.state.mode;
    const status = this.providerStatus.get(currentMode) || { isInitialized: false, error: 'Status unknown' };
    
    return {
      name: currentMode,
      status: status.isInitialized ? 'Ready' : 'Not ready',
      error: status.error,
      provider: this.activeProvider
    };
  }

  // Pre-initialize providers in background for faster mode switching
  async preInitializeProviders() {
    const providersToInit = Array.from(this.searchProviders.entries())
      .filter(([name, provider]) => {
        const status = this.providerStatus.get(name);
        return !status?.isInitialized && name !== this.state.mode;
      });

    if (providersToInit.length === 0) {
      return;
    }

    console.log(`Pre-initializing ${providersToInit.length} providers in background...`);
    
    const initPromises = providersToInit.map(async ([name, provider]) => {
      try {
        const initResult = await provider.initialize();
        this.providerStatus.set(name, { 
          isInitialized: initResult, 
          error: initResult ? null : 'Pre-initialization failed'
        });
        
        if (initResult) {
          console.log(`Pre-initialized provider: ${name}`);
        }
      } catch (error) {
        console.warn(`Failed to pre-initialize provider ${name}:`, error.message);
        this.providerStatus.set(name, { 
          isInitialized: false, 
          error: error.message 
        });
      }
    });

    // Don't await - let this run in background
    Promise.allSettled(initPromises).then(() => {
      console.log('Provider pre-initialization completed');
    });
  }

  // Retry failed provider initialization
  async retryProviderInitialization(providerName, maxRetries = 3) {
    const provider = this.searchProviders.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    const status = this.providerStatus.get(providerName);
    if (status?.isInitialized) {
      return true; // Already initialized
    }

    console.log(`Retrying initialization for provider: ${providerName}`);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries} for ${providerName}...`);
        const initResult = await provider.initialize();
        
        this.providerStatus.set(providerName, { 
          isInitialized: initResult, 
          error: initResult ? null : `Initialization failed on attempt ${attempt}`
        });
        
        if (initResult) {
          console.log(`Successfully initialized ${providerName} on attempt ${attempt}`);
          return true;
        }
      } catch (error) {
        console.warn(`Attempt ${attempt} failed for ${providerName}:`, error.message);
        
        if (attempt === maxRetries) {
          this.providerStatus.set(providerName, { 
            isInitialized: false, 
            error: `Failed after ${maxRetries} attempts: ${error.message}`
          });
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    
    return false;
  }
} 