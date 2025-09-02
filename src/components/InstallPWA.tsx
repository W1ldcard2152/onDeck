'use client'

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useServiceWorker } from '@/hooks/useServiceWorker';

interface InstallPWAProps {
  className?: string;
}

export const InstallPWA: React.FC<InstallPWAProps> = ({ className }) => {
  // Use our enhanced PWA installation hook
  const { canInstall, isIOS, isStandalone, outcome, promptInstall } = usePWAInstall();
  
  // Track if we're showing iOS instructions
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  
  // Memoize service worker options to prevent re-registration
  const serviceWorkerOptions = useMemo(() => ({
    onSuccess: (registration: ServiceWorkerRegistration) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[PWA] Service worker registered successfully:', registration);
      }
    },
    onError: (error: Error) => {
      console.error('[PWA] Service worker registration failed:', error);
    }
  }), []);

  // Use service worker hook to ensure it's active before showing install
  const { isActive, isRegistered } = useServiceWorker(serviceWorkerOptions);
  
  // If service worker is not active (except for iOS which doesn't use it),
  // or if the app is already installed, don't show anything
  if ((!isActive && !isIOS) || isStandalone) {
    return null;
  }

  // Don't show install button if it's not installable
  if (!canInstall) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      // For iOS, we just toggle the instruction panel
      setShowIOSInstructions(!showIOSInstructions);
      return;
    }

    // For other platforms, trigger the installation prompt
    await promptInstall();
  };

  return (
    <div className={`mb-4 ${className}`}>
      {outcome === 'dismissed' && (
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