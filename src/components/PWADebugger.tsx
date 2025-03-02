'use client'

import React, { useState, useEffect } from 'react';

export default function PWADebugger() {
  const [debug, setDebug] = useState<{
    isStandalone: boolean;
    hasServiceWorker: boolean;
    hasPWAManifest: boolean;
    promptEventCaptured: boolean;
    installButtonShown: boolean;
    userAgent: string;
  }>({
    isStandalone: false,
    hasServiceWorker: false,
    hasPWAManifest: false,
    promptEventCaptured: false,
    installButtonShown: false,
    userAgent: '',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if the app is running in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                     (window.navigator as any).standalone === true;

    // Check if the browser has service worker support
    const hasServiceWorker = 'serviceWorker' in navigator;

    // Check if we have a manifest link
    const hasPWAManifest = !!document.querySelector('link[rel="manifest"]');

    // Get user agent for debugging
    const userAgent = navigator.userAgent;

    // Update debug info
    setDebug({
      isStandalone,
      hasServiceWorker,
      hasPWAManifest,
      promptEventCaptured: false, // Will be updated by event listener
      installButtonShown: false,  // Will be updated by InstallPWA component
      userAgent,
    });

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = () => {
      setDebug(prev => ({ ...prev, promptEventCaptured: true }));
      console.log('Prompt event captured!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // This is how we would update from InstallPWA if needed
    // We could use a context or other method to communicate
    const checkForInstallButton = setInterval(() => {
      const hasInstallButton = !!document.querySelector('[data-pwa-install-button]');
      setDebug(prev => {
        if (prev.installButtonShown !== hasInstallButton) {
          return { ...prev, installButtonShown: hasInstallButton };
        }
        return prev;
      });
    }, 1000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearInterval(checkForInstallButton);
    };
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border rounded shadow p-4 text-xs max-w-xs opacity-80 hover:opacity-100 transition-opacity">
      <h3 className="font-bold mb-2">PWA Debug Info</h3>
      <ul className="space-y-1">
        <li>Standalone Mode: <span className={debug.isStandalone ? "text-green-600" : "text-red-600"}>
          {debug.isStandalone ? "Yes ✓" : "No ✗"}
        </span></li>
        <li>Service Worker Support: <span className={debug.hasServiceWorker ? "text-green-600" : "text-red-600"}>
          {debug.hasServiceWorker ? "Yes ✓" : "No ✗"}
        </span></li>
        <li>Manifest Found: <span className={debug.hasPWAManifest ? "text-green-600" : "text-red-600"}>
          {debug.hasPWAManifest ? "Yes ✓" : "No ✗"}
        </span></li>
        <li>Install Prompt Captured: <span className={debug.promptEventCaptured ? "text-green-600" : "text-red-600"}>
          {debug.promptEventCaptured ? "Yes ✓" : "No ✗"}
        </span></li>
        <li>Install Button Shown: <span className={debug.installButtonShown ? "text-green-600" : "text-red-600"}>
          {debug.installButtonShown ? "Yes ✓" : "No ✗"}
        </span></li>
        <li className="text-[8px] break-all mt-2 text-gray-500">UA: {debug.userAgent}</li>
      </ul>
    </div>
  );
}