import { useEffect, useState, useCallback } from 'react';

interface UseServiceWorkerOptions {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
  silent?: boolean; // Skip success callbacks for status monitoring
}

// Global flag to prevent multiple registrations
let isRegistering = false;
let globalRegistration: ServiceWorkerRegistration | null = null;
let hasLoggedSuccess = false; // Prevent duplicate success logging

export function useServiceWorker(options: UseServiceWorkerOptions = {}) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Memoize callbacks to prevent re-registration
  const onSuccess = useCallback(options.onSuccess || (() => {}), [options.onSuccess]);
  const onUpdate = useCallback(options.onUpdate || (() => {}), [options.onUpdate]);
  const onError = useCallback(options.onError || (() => {}), [options.onError]);
  const silent = options.silent || false;
  
  useEffect(() => {
    // Only run in browser environment and if service workers are supported
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    
    // Check for existing registration first
    const checkExisting = async () => {
      try {
        const existingReg = await navigator.serviceWorker.getRegistration('/sw.js');
        if (existingReg && !isRegistering) {
          if (!hasLoggedSuccess && !silent) {
            console.log('Using existing service worker registration');
            hasLoggedSuccess = true;
          }
          globalRegistration = existingReg;
          setRegistration(existingReg);
          setIsRegistered(true);
          setIsActive(Boolean(existingReg.active));
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`useServiceWorker: Set state - registered: true, active: ${Boolean(existingReg.active)}, silent: ${silent}`);
          }
          
          if (!silent) {
            onSuccess(existingReg);
          }
          return true;
        }
        return false;
      } catch (err) {
        console.error('Error checking existing service worker:', err);
        return false;
      }
    };
    
    // Register the service worker only if not already registering/registered
    const registerSW = async () => {
      if (isRegistering || globalRegistration) {
        // If we already have a global registration, update this hook's state
        if (globalRegistration) {
          setRegistration(globalRegistration);
          setIsRegistered(true);
          setIsActive(Boolean(globalRegistration.active));
        }
        return;
      }
      
      const hasExisting = await checkExisting();
      if (hasExisting) return;
      
      try {
        isRegistering = true;
        console.log('Registering service worker...');
        
        const reg = await navigator.serviceWorker.register('/sw.js');
        globalRegistration = reg;
        setRegistration(reg);
        setIsRegistered(true);
        setIsActive(Boolean(reg.active));
        
        if (!silent) {
          onSuccess(reg);
          console.log('Service worker registered successfully!', reg);
        }
        
        // Check for updates to the service worker
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;
          
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New content is available, call onUpdate callback if provided
                console.log('New content is available; please refresh.');
                if (!silent) {
                  onUpdate(reg);
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
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        if (!silent) {
          onError(error);
        }
      } finally {
        isRegistering = false;
      }
    };
    
    registerSW();
    
    // Clean up function
    return () => {
      // No need to unregister service worker
    };
  }, [onSuccess, onUpdate, onError, silent]); // Fixed dependencies
  
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