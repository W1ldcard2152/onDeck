'use client'

import React, { useState, useEffect } from 'react';
import { useServiceWorker } from '@/hooks/useServiceWorker';

interface PWAStatusProps {
  showDebug?: boolean;
}

const PWAStatus: React.FC<PWAStatusProps> = ({ showDebug = false }) => {
  const [installable, setInstallable] = useState<boolean | null>(null);
  const [installed, setInstalled] = useState<boolean | null>(null);
  const [online, setOnline] = useState<boolean>(true);
  
  // Use the enhanced service worker hook
  const { isActive, isRegistered, error } = useServiceWorker();

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    // Check if online
    setOnline(navigator.onLine);
    window.addEventListener('online', () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));

    // Check if PWA is installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         (window.navigator as any).standalone === true;
    setInstalled(isStandalone);

    // Listen for beforeinstallprompt to detect if installable
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallable(true);
      console.log('App is installable - beforeinstallprompt event fired');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', () => setOnline(true));
      window.removeEventListener('offline', () => setOnline(false));
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // If debugging is disabled or we're not in development mode
  if (!showDebug && process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-2 right-2 bg-white border shadow-lg rounded-lg p-3 text-xs font-mono z-50 opacity-70 hover:opacity-100 transition-opacity">
      <h3 className="font-bold mb-1">PWA Status</h3>
      <div className="grid grid-cols-2 gap-x-2">
        <span>Online:</span>
        <span className={online ? 'text-green-600' : 'text-red-600'}>
          {online ? '✅ Yes' : '❌ No'}
        </span>
        
        <span>Installable:</span>
        <span className={installable ? 'text-green-600' : 'text-red-600'}>
          {installable === null ? '❓ Unknown' : installable ? '✅ Yes' : '❌ No'}
        </span>
        
        <span>Installed:</span>
        <span className={installed ? 'text-green-600' : 'text-red-600'}>
          {installed === null ? '❓ Unknown' : installed ? '✅ Yes' : '❌ No'}
        </span>
        
        <span>SW Registered:</span>
        <span className={isRegistered ? 'text-green-600' : 'text-red-600'}>
          {isRegistered ? '✅ Yes' : '❌ No'}
        </span>
        
        <span>SW Active:</span>
        <span className={isActive ? 'text-green-600' : 'text-red-600'}>
          {isActive ? '✅ Yes' : '❌ No'}
        </span>
        
        {error && (
          <>
            <span>Error:</span>
            <span className="text-red-600">
              {error.message.substring(0, 30)}...
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default PWAStatus;