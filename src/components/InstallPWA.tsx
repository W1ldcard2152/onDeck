'use client'

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, HelpCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [isAndroid, setIsAndroid] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showAndroidInstructions, setShowAndroidInstructions] = useState(false);
  const [installOutcome, setInstallOutcome] = useState<'accepted' | 'dismissed' | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [promptEventFired, setPromptEventFired] = useState(false);
  
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

      // Detect device types
      const userAgent = navigator.userAgent.toLowerCase();
      const isIOSDevice = /ipad|iphone|ipod/.test(userAgent) || 
                      (userAgent.includes("mac") && "ontouchend" in document);
      const isAndroidDevice = /android/.test(userAgent);
      
      setIsIOS(isIOSDevice);
      setIsAndroid(isAndroidDevice);

      // For iOS or Android devices without prompt, we can show manual install instructions
      if (isIOSDevice || isAndroidDevice) {
        setShowInstallButton(true);
      }

      // For devices that support the install prompt
      const handleBeforeInstallPrompt = (e: Event) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        
        console.log('BeforeInstallPrompt event fired!');
        setPromptEventFired(true);
        
        // Store the event for later use
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
    // If we have a deferred prompt, use it
    if (deferredPrompt) {
      console.log('Triggering install prompt');
      deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const choiceResult = await deferredPrompt.userChoice;
      
      // Update state based on user's choice
      setInstallOutcome(choiceResult.outcome);
      
      // We've used the prompt, clear it
      setDeferredPrompt(null);
      
      // Hide the install button if installed
      if (choiceResult.outcome === 'accepted') {
        setShowInstallButton(false);
      }
      return;
    }
    
    // Otherwise, show appropriate instructions based on device
    if (isIOS) {
      setShowIOSInstructions(!showIOSInstructions);
      setShowAndroidInstructions(false);
    } else if (isAndroid) {
      setShowAndroidInstructions(!showAndroidInstructions);
      setShowIOSInstructions(false);
    }
  };

  // If already in standalone mode or the app was installed, don't show anything
  if (isStandalone || (installOutcome === 'accepted')) {
    return null;
  }

  // Don't show if we have no prompt and aren't on iOS/Android
  if (!showInstallButton && !isIOS && !isAndroid) {
    return null;
  }

  return (
    <div className={`mb-4 ${className}`} data-pwa-install-button>
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
        {isIOS ? "Install on iOS" : isAndroid ? "Install on Android" : "Install App"}
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
      
      {isAndroid && showAndroidInstructions && (
        <div className="mt-2 text-sm text-gray-600 p-3 bg-gray-50 rounded-md relative">
          <button 
            className="absolute top-2 right-2"
            onClick={() => setShowAndroidInstructions(false)}
          >
            <X className="h-4 w-4" />
          </button>
          <p className="font-medium">To install this app on Android:</p>
          <ol className="list-decimal ml-5 mt-2">
            <li>Tap the menu <span className="inline-block border rounded px-1">⋮</span> in Chrome</li>
            <li>Tap <span className="font-medium">"Install app"</span> or <span className="font-medium">"Add to Home screen"</span></li>
            <li>Follow the on-screen instructions</li>
          </ol>
          
          {!promptEventFired && (
            <div className="flex items-start mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
              <HelpCircle className="h-4 w-4 text-yellow-500 mr-2 mt-0.5" />
              <p className="text-xs">
                If you don't see the install option, try: refreshing the page, using Chrome browser, or checking if the app meets all installability criteria.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InstallPWA;