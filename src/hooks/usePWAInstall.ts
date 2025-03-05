// hooks/usePWAInstall.ts
import { useState, useEffect } from 'react';

// Define the BeforeInstallPromptEvent interface which extends the standard Event
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [outcome, setOutcome] = useState<'accepted' | 'dismissed' | null>(null);

  useEffect(() => {
    // This effect runs only once when the component mounts

    if (typeof window === 'undefined') return; // Guard against SSR

    // Check if already installed in standalone mode
    const checkStandalone = () => {
      const isAppleStandalone = 'standalone' in window.navigator && (window.navigator as any).standalone === true;
      const isStandardStandalone = window.matchMedia('(display-mode: standalone)').matches;
      return isAppleStandalone || isStandardStandalone;
    };
    
    const standalone = checkStandalone();
    setIsStandalone(standalone);
    
    // If already in standalone mode, no need to continue
    if (standalone) return;

    // Check if we're on iOS
    const checkIsIOS = () => {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
             (navigator.userAgent.includes("Mac") && "ontouchend" in document);
    };
    
    const isiOS = checkIsIOS();
    setIsIOS(isiOS);
    
    // Set can install for iOS immediately since it's always possible
    if (isiOS) {
      setCanInstall(true);
    }

    // Handle the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 76+ from automatically showing the prompt
      e.preventDefault();
      
      // Log that we captured the event
      console.log('[PWA] beforeinstallprompt event was captured', e);
      
      // Store event for later use
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Update UI to notify the user they can install the PWA
      setCanInstall(true);
    };

    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App was installed successfully');
      setOutcome('accepted');
      setCanInstall(false);
      setDeferredPrompt(null);
    });

    // Check for standalone mode changes
    const mediaQueryList = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
      if (e.matches) {
        setCanInstall(false);
      }
    };
    
    // Modern browsers use addEventListener
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handleDisplayModeChange);
    } 
    // Older browsers use addListener (deprecated but needed for compatibility)
    else if ('addListener' in mediaQueryList) {
      // @ts-ignore - For older browsers that don't support addEventListener
      mediaQueryList.addListener(handleDisplayModeChange);
    }

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handleDisplayModeChange);
      } 
      else if ('removeListener' in mediaQueryList) {
        // @ts-ignore - For older browsers
        mediaQueryList.removeListener(handleDisplayModeChange);
      }
    };
  }, []);

  // Function to trigger the installation prompt
  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    // If on iOS, we can't programmatically trigger the install
    if (isIOS) {
      return 'unavailable';
    }
    
    // Check if we have a deferred prompt
    if (!deferredPrompt) {
      console.log('[PWA] Cannot install: No installation prompt available');
      return 'unavailable';
    }

    try {
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const choiceResult = await deferredPrompt.userChoice;
      
      // Set the outcome state
      setOutcome(choiceResult.outcome);
      
      // Clear the deferred prompt as it can't be used again
      setDeferredPrompt(null);
      
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the installation prompt');
        setCanInstall(false);
      } else {
        console.log('[PWA] User dismissed the installation prompt');
      }
      
      return choiceResult.outcome;
    } catch (error) {
      console.error('[PWA] Error triggering install prompt:', error);
      return 'unavailable';
    }
  };
  
  // Return all the state and functions needed by components
  return {
    canInstall,
    isIOS,
    isStandalone,
    outcome,
    promptInstall
  };
}