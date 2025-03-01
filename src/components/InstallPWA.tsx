'use client'

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export const InstallPWA: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if the device is iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                         (navigator.userAgent.includes("Mac") && "ontouchend" in document);
    setIsIOS(isIOSDevice);

    // For non-iOS devices, listen for beforeinstallprompt
    if (!isIOSDevice) {
      const handleBeforeInstallPrompt = (e: Event) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later
        setDeferredPrompt(e);
        // Update UI to show install button
        setShowInstallButton(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

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
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We no longer need the prompt, clear it
    setDeferredPrompt(null);
    setShowInstallButton(false);
  };

  if (!showInstallButton && !isIOS) return null;

  return (
    <div className="mb-4">
      <Button
        onClick={handleInstallClick}
        className="w-full mb-2"
        variant="outline"
      >
        <Download className="mr-2 h-4 w-4" />
        {isIOS ? "Install on iOS" : "Install App"}
      </Button>
      
      {showIOSInstructions && (
        <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded-md">
          <p>To install this app on iOS:</p>
          <ol className="list-decimal ml-5 mt-2">
            <li>Tap the Share button in Safari</li>
            <li>Scroll down and tap "Add to Home Screen"</li>
            <li>Tap "Add" in the top-right corner</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default InstallPWA;