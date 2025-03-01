'use client'

import { useState, useEffect, useCallback } from 'react';
import { offlineDataManager } from '@/lib/offlineDataManager';

interface UseOfflineDataProps<T> {
  collection: 'tasks' | 'notes' | 'projects';
  onlineData?: T[];
  isOnlineLoading?: boolean;
}

/**
 * Hook for handling offline data access with online fallback
 */
export function useOfflineData<T>({ 
  collection, 
  onlineData = [], 
  isOnlineLoading = false 
}: UseOfflineDataProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Check online status and load appropriate data
  useEffect(() => {
    const checkConnectionAndLoadData = async () => {
      // Check if we're offline
      const offline = offlineDataManager.isOffline();
      setIsOffline(offline);
      
      if (!offline && onlineData.length > 0 && !isOnlineLoading) {
        // If we're online and have data from the online source, use it and cache it
        setData(onlineData);
        await offlineDataManager.cacheCollection(collection, onlineData);
        setLoading(false);
        return;
      }
      
      // Otherwise, load from cache
      try {
        setLoading(true);
        const cachedData = await offlineDataManager.getCollection<T>(collection);
        setData(cachedData);
        
        // Get last synced time
        const cache = await offlineDataManager.getCache();
        setLastSynced(cache.lastSynced);
      } catch (error) {
        console.error(`Error loading ${collection} from cache:`, error);
      } finally {
        setLoading(false);
      }
    };
    
    checkConnectionAndLoadData();
    
    // Listen for online/offline events
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [collection, onlineData, isOnlineLoading]);
  
  // Function to add a new item
  const addItem = useCallback(async (item: T) => {
    try {
      // Add to local state first for immediate UI update
      setData(prev => [...prev, item]);
      
      // Queue for sync when online
      await offlineDataManager.queueChange(collection, 'create', item);
      
      // Update the cache
      const currentItems = await offlineDataManager.getCollection<T>(collection);
      await offlineDataManager.cacheCollection(collection, [...currentItems, item]);
      
      return true;
    } catch (error) {
      console.error(`Error adding item to ${collection}:`, error);
      return false;
    }
  }, [collection]);
  
  // Function to update an item
  const updateItem = useCallback(async (id: string, updates: Partial<T>) => {
    try {
      // Update local state first
      setData(prev => 
        prev.map(item => {
          // @ts-ignore - We're assuming all items have an id field
          if (item.id === id) {
            return { ...item, ...updates };
          }
          return item;
        })
      );
      
      // Queue for sync when online
      await offlineDataManager.queueChange(collection, 'update', { id, ...updates });
      
      // Update the cache
      const currentItems = await offlineDataManager.getCollection<T>(collection);
      const updatedItems = currentItems.map(item => {
        // @ts-ignore
        if (item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      });
      await offlineDataManager.cacheCollection(collection, updatedItems);
      
      return true;
    } catch (error) {
      console.error(`Error updating item in ${collection}:`, error);
      return false;
    }
  }, [collection]);
  
  // Function to delete an item
  const deleteItem = useCallback(async (id: string) => {
    try {
      // Remove from local state first
      setData(prev => prev.filter(item => 
        // @ts-ignore - We're assuming all items have an id field
        item.id !== id
      ));
      
      // Queue for sync when online
      await offlineDataManager.queueChange(collection, 'delete', { id });
      
      // Update the cache
      const currentItems = await offlineDataManager.getCollection<T>(collection);
      // @ts-ignore
      const filteredItems = currentItems.filter(item => item.id !== id);
      await offlineDataManager.cacheCollection(collection, filteredItems);
      
      return true;
    } catch (error) {
      console.error(`Error deleting item from ${collection}:`, error);
      return false;
    }
  }, [collection]);

  return {
    data,
    loading,
    isOffline,
    lastSynced,
    addItem,
    updateItem,
    deleteItem
  };
}