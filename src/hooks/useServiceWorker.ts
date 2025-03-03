import { useEffect, useState } from 'react';

interface UseServiceWorkerOptions {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

export function useServiceWorker(options: UseServiceWorkerOptions = {}) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    // Only run in browser environment and if service workers are supported
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('Service workers are not supported in this browser');
      return;
    }
    
    // Register the service worker
    const registerSW = async () => {
      try {
        console.log('Registering service worker...');
        
        // Using the sw.js file in the public directory
        const reg = await navigator.serviceWorker.register('/sw.js');
        setRegistration(reg);
        setIsRegistered(true);
        setIsActive(Boolean(reg.active));
        
        // Call onSuccess callback if provided
        if (options.onSuccess) {
          options.onSuccess(reg);
        }
        
        console.log('Service worker registered successfully!', reg);
        
        // Check for updates to the service worker
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;
          
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New content is available, call onUpdate callback if provided
                console.log('New content is available; please refresh.');
                if (options.onUpdate) {
                  options.onUpdate(reg);
                }
              } else {
                // Content is cached for offline use
                console.log('Content is cached for offline use.');
                setIsActive(true);
              }
            }
          };
        };
        
        // Listen for controlling changes (when the service worker takes control)
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('Service worker controller changed');
          setIsActive(true);
        });
        
      } catch (err) {
        console.error('Error registering service worker:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        
        // Call onError callback if provided
        if (options.onError && err instanceof Error) {
          options.onError(err);
        }
      }
    };
    
    registerSW();
    
    // Clean up function
    return () => {
      // No need to unregister service worker
    };
  }, [options]);
  
  // Check if service worker is active on initial load
  useEffect(() => {
    const checkActive = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          setIsActive(regs.length > 0 && Boolean(regs[0].active));
        } catch (err) {
          console.error('Error checking service worker status:', err);
        }
      }
    };
    
    checkActive();
  }, []);
  
  // Function to update the service worker
  const update = async () => {
    if (registration) {
      try {
        await registration.update();
      } catch (err) {
        console.error('Error updating service worker:', err);
      }
    }
  };
  
  // Function to unregister the service worker
  const unregister = async () => {
    if (registration) {
      try {
        const success = await registration.unregister();
        if (success) {
          setIsRegistered(false);
          setIsActive(false);
          setRegistration(null);
          console.log('Service worker unregistered successfully');
        }
      } catch (err) {
        console.error('Error unregistering service worker:', err);
      }
    }
  };
  
  return { 
    registration, 
    isActive, 
    isRegistered, 
    error,
    update,
    unregister
  };
}

export default useServiceWorker;