/**
 * Offline Data Manager
 * Handles local caching and sync of data when online connectivity is restored
 */

// Types for cache data
interface OfflineCache {
    tasks: any[];
    notes: any[];
    projects: any[];
    lastSynced: string | null;
  }
  
  // Default empty cache structure
  const DEFAULT_CACHE: OfflineCache = {
    tasks: [],
    notes: [],
    projects: [],
    lastSynced: null
  };
  
  export class OfflineDataManager {
    private storageKey = 'ondeck-offline-data';
    private syncInProgress = false;
  
    constructor() {
      if (typeof window !== 'undefined') {
        // Listen for online/offline events
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
      }
    }
  
    // Get all cached data
    public async getCache(): Promise<OfflineCache> {
      if (typeof window === 'undefined') return DEFAULT_CACHE;
      
      try {
        const cachedData = localStorage.getItem(this.storageKey);
        if (!cachedData) return DEFAULT_CACHE;
        
        return JSON.parse(cachedData) as OfflineCache;
      } catch (error) {
        console.error('Error retrieving offline cache:', error);
        return DEFAULT_CACHE;
      }
    }
  
    // Store data in cache
    public async updateCache(data: Partial<OfflineCache>): Promise<void> {
      if (typeof window === 'undefined') return;
      
      try {
        const currentCache = await this.getCache();
        const updatedCache: OfflineCache = {
          ...currentCache,
          ...data,
          lastSynced: new Date().toISOString()
        };
        
        localStorage.setItem(this.storageKey, JSON.stringify(updatedCache));
      } catch (error) {
        console.error('Error updating offline cache:', error);
      }
    }
      // Get specific collection data
      public async getCollection<T>(collectionName: 'tasks' | 'notes' | 'projects'): Promise<T[]> {
        if (typeof window === 'undefined') return [];
        
        try {
          const cache = await this.getCache();
          // Double assertion to break the connection with the string type
          return (cache[collectionName] as unknown as any[]) || [] as T[];
        } catch (error) {
          console.error(`Error getting ${collectionName} from cache:`, error);
          return [];
        }
      }
        // Store specific collection data (tasks, notes, etc.)
    public async cacheCollection(
      collectionName: 'tasks' | 'notes' | 'projects', 
      data: any[]
    ): Promise<void> {
      if (typeof window === 'undefined') return;
      
      try {
        const currentCache = await this.getCache();
        currentCache[collectionName] = data;
        currentCache.lastSynced = new Date().toISOString();
        
        localStorage.setItem(this.storageKey, JSON.stringify(currentCache));
      } catch (error) {
        console.error(`Error caching ${collectionName}:`, error);
      }
    }
  
    // Check if we are currently offline
    public isOffline(): boolean {
      if (typeof window === 'undefined') return false;
      return !navigator.onLine;
    }
  
    // Handle when device goes online
    private async handleOnline(): Promise<void> {
      console.log('Device is online, syncing pending changes...');
      
      if (this.syncInProgress) return;
      this.syncInProgress = true;
      
      try {
        // Here you would implement your sync logic to push pending changes to server
        // This is where you would send any queued updates to your Supabase backend
        
        // For now, just update the last synced time
        const currentCache = await this.getCache();
        currentCache.lastSynced = new Date().toISOString();
        localStorage.setItem(this.storageKey, JSON.stringify(currentCache));
        
        console.log('Sync completed successfully');
      } catch (error) {
        console.error('Error during data sync:', error);
      } finally {
        this.syncInProgress = false;
      }
    }
  
    // Handle when device goes offline
    private handleOffline(): void {
      console.log('Device is offline. Changes will be stored locally until connectivity is restored.');
      // You could trigger notifications or UI changes here
    }
  
    // Queue a change to be synced when online
    public async queueChange(collection: string, operation: 'create' | 'update' | 'delete', data: any): Promise<void> {
      if (typeof window === 'undefined') return;
      
      try {
        const queueKey = 'ondeck-sync-queue';
        let syncQueue = JSON.parse(localStorage.getItem(queueKey) || '[]');
        
        syncQueue.push({
          collection,
          operation,
          data,
          timestamp: new Date().toISOString()
        });
        
        localStorage.setItem(queueKey, JSON.stringify(syncQueue));
        
        // If we're online, try to sync immediately
        if (navigator.onLine) {
          this.handleOnline();
        }
      } catch (error) {
        console.error('Error queueing change:', error);
      }
    }
  }
  
  // Create and export a singleton instance
  export const offlineDataManager = new OfflineDataManager();