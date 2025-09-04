'use client'

import React, { useEffect, useState } from 'react';
import { ArrowLeft, RotateCw, Home } from 'lucide-react';

interface PWANavigationBarProps {
  onHomeClick?: () => void;
}

export default function PWANavigationBar({ onHomeClick }: PWANavigationBarProps) {
  const [isInPWA, setIsInPWA] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [platform, setPlatform] = useState<'mobile' | 'desktop' | 'unknown'>('unknown');

  useEffect(() => {
    // Check if running as PWA
    const checkPWAStatus = () => {
      // More comprehensive PWA detection
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          window.matchMedia('(display-mode: fullscreen)').matches ||
                          window.matchMedia('(display-mode: minimal-ui)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      
      // Debug logging
      if (typeof window !== 'undefined') {
        console.log('PWA Detection Debug:', {
          'display-mode standalone': window.matchMedia('(display-mode: standalone)').matches,
          'display-mode fullscreen': window.matchMedia('(display-mode: fullscreen)').matches,
          'display-mode minimal-ui': window.matchMedia('(display-mode: minimal-ui)').matches,
          'navigator.standalone': (window.navigator as any).standalone,
          'android-app referrer': document.referrer.includes('android-app://'),
          'userAgent': navigator.userAgent
        });
      }
      
      setIsInPWA(isStandalone);
      
      // Detect platform
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      setPlatform(isMobile ? 'mobile' : 'desktop');
      
      console.log('PWA Navigation State:', { isInPWA: isStandalone, platform: isMobile ? 'mobile' : 'desktop' });
      
      // Check if we can go back
      setCanGoBack(window.history.length > 1);
    };

    checkPWAStatus();

    // Listen for history changes
    const handlePopState = () => {
      setCanGoBack(window.history.length > 1);
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Temporary debug view for development - shows PWA detection state
  if (platform === 'mobile' && !isInPWA) {
    return (
      <div className="fixed bottom-24 right-4 z-40 bg-red-500 text-white p-2 rounded text-xs max-w-48">
        PWA Debug: Not detected as PWA
        <br />Platform: {platform}
        <br />Check console logs
      </div>
    );
  }

  // Don't show navigation bar if not in PWA mode
  if (!isInPWA) {
    return null;
  }

  // On mobile PWA, show a minimal floating button for refresh only
  // Mobile browsers usually provide back gesture/button
  if (platform === 'mobile') {
    return (
      <div className="fixed bottom-24 right-4 z-40 flex gap-2">
        <button
          onClick={() => window.location.reload()}
          className="bg-white shadow-lg rounded-full p-3 hover:bg-gray-50 active:scale-95 transition-transform"
          aria-label="Refresh page"
        >
          <RotateCw className="w-5 h-5 text-gray-700" />
        </button>
      </div>
    );
  }

  // Desktop PWA - show full navigation bar at top
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex items-center gap-2">
        {/* Back button */}
        <button
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            }
          }}
          disabled={!canGoBack}
          className={`p-2 rounded-lg transition-colors ${
            canGoBack 
              ? 'hover:bg-gray-100 text-gray-700' 
              : 'text-gray-300 cursor-not-allowed'
          }`}
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Refresh button */}
        <button
          onClick={() => window.location.reload()}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
          aria-label="Refresh page"
        >
          <RotateCw className="w-5 h-5" />
        </button>

        {/* Home button */}
        {onHomeClick && (
          <button
            onClick={onHomeClick}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors"
            aria-label="Go to home"
          >
            <Home className="w-5 h-5" />
          </button>
        )}

        {/* App title */}
        <div className="ml-4 flex items-center">
          <span className="text-sm font-medium text-gray-700">OnDeck</span>
        </div>
      </div>
    </div>
  );
}