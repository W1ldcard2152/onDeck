'use client'

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useServiceWorker } from '@/hooks/useServiceWorker';

// Define a type for the BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPWAProps {
  className?: string;
}

export const InstallPWA: React.FC<InstallPWAProps> = ({ className }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [installOutcome, setInstallOutcome] = useState<'accepted' | 'dismissed' | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  
  // Use our enhanced service worker hook
  const { isActive, isRegistered } = useServiceWorker({
    onSuccess: (registration) => {
      console.log('Service worker registered for PWA installation:', registration);
    },
    onError: (error) => {
      console.error('Service worker registration failed for PWA:', error);
    }
  });
  
  useEffect(() => {
    // Debug log for development
    console.log('Service worker status for PWA:', { isActive, isRegistered });
  }, [isActive, isRegistered]);
  
  useEffect(() => {
    // Check if already installed (running in standalone mode)
    if (typeof window !== 'undefined') {
      // For iOS devices using Apple's non-standard approach
      const isAppleStandalone = 'standalone' in window.navigator && (window.navigator as any).standalone === true;
      
      // For all other browsers supporting the standard
      const isStandardStandalone = window.matchMedia('(display-mode: standalone)').matches;
      
      setIsStandalone(isAppleStandalone || isStandardStandalone);
      
      // If already installed, no need to show install button
      if (isAppleStandalone || isStandardStandalone) {
        setShowInstallButton(false);
        return;
      }

      // Check if the device is iOS
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                          (navigator.userAgent.includes("Mac") && "ontouchend" in document);
      setIsIOS(isIOSDevice);

      // For iOS devices, we need to show custom install instructions
      if (isIOSDevice) {
        // Only show if not already in standalone mode
        setShowInstallButton(true);
      }

      // For non-iOS devices that support the install prompt
      const handleBeforeInstallPrompt = (e: Event) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        
        // Store the event for later use
        console.log('Capture beforeinstallprompt event for later use');
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        
        // Show install button
        setShowInstallButton(true);
      };

      // Listen for beforeinstallprompt event
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // Listen for the appinstalled event
      window.addEventListener('appinstalled', () => {
        // Clear the deferredPrompt
        setDeferredPrompt(null);
        
        // Hide the install button
        setShowInstallButton(false);
        
        // Set outcome to accepted
        setInstallOutcome('accepted');
        
        // Log the installation
        console.log('PWA was installed');
      });

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      // Show iOS installation instructions
      setShowIOSInstructions(!showIOSInstructions);
      return;
    }

    if (!deferredPrompt) {
      console.log('No installation prompt available');
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    try {
      console.log('Waiting for user response to install prompt');
      const choiceResult = await deferredPrompt.userChoice;
      
      // Update state based on user's choice
      setInstallOutcome(choiceResult.outcome);
      console.log(`User ${choiceResult.outcome} the PWA installation`);
      
      // We've used the prompt, clear it
      setDeferredPrompt(null);
      
      // Hide the install button if installed
      if (choiceResult.outcome === 'accepted') {
        setShowInstallButton(false);
      }
    } catch (error) {
      console.error('Error during PWA installation:', error);
    }
  };

  // If service worker is not active or registered, don't show anything
  if (!isActive && !isIOS) {
    console.log('Service worker not active, hiding install button');
    return null;
  }

  // If already in standalone mode or the app was installed, don't show anything
  if (isStandalone || (installOutcome === 'accepted')) {
    return null;
  }

  // Don't show if we don't have a prompt (except for iOS)
  if (!showInstallButton && !isIOS) {
    return null;
  }

  return (
    <div className={`mb-4 ${className}`}>
      {installOutcome === 'dismissed' && (
        <Alert className="mb-2 bg-blue-50 text-blue-800">
          <AlertDescription>You can install the app later from the menu.</AlertDescription>
        </Alert>
      )}
      
      <Button
        onClick={handleInstallClick}
        className="w-full"
        variant="outline"
      >
        <Download className="mr-2 h-4 w-4" />
        {isIOS ? "Install on iOS" : "Install App"}
      </Button>
      
      {isIOS && showIOSInstructions && (
        <div className="mt-2 text-sm text-gray-600 p-3 bg-gray-50 rounded-md relative">
          <button 
            className="absolute top-2 right-2"
            onClick={() => setShowIOSInstructions(false)}
          >
            <X className="h-4 w-4" />
          </button>
          <p className="font-medium">To install this app on iOS:</p>
          <ol className="list-decimal ml-5 mt-2">
            <li>Tap the <span className="inline-block border rounded px-1">Share</span> button in Safari</li>
            <li>Scroll down and tap <span className="font-medium">"Add to Home Screen"</span></li>
            <li>Tap <span className="font-medium">"Add"</span> in the top-right corner</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default InstallPWA;