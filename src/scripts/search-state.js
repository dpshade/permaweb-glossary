export class SearchState {
  constructor() {
    this.mode = 'basic';
    this.isInitialized = false;
    this.currentResults = [];
    this.subscribers = new Set();
  }

  setState(newState) {
    Object.assign(this, newState);
    this.notifySubscribers();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers() {
    for (const subscriber of this.subscribers) {
      subscriber(this);
    }
  }
} 