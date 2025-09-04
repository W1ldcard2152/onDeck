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
      
      setIsInPWA(isStandalone);
      
      // Detect platform
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      setPlatform(isMobile ? 'mobile' : 'desktop');
      
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

  // Don't show navigation bar if not in PWA mode
  if (!isInPWA) {
    return null;
  }

  // On mobile PWA, show a persistent floating button for refresh
  // Use higher z-index and more stable positioning
  if (platform === 'mobile') {
    return (
      <div 
        className="fixed bottom-24 right-4 z-[9999] flex gap-2"
        style={{ 
          position: 'fixed',
          bottom: '6rem',
          right: '1rem',
          zIndex: 9999
        }}
      >
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 text-white shadow-lg rounded-full p-3 hover:bg-blue-700 active:scale-95 transition-all duration-200"
          aria-label="Refresh page"
          style={{
            position: 'relative',
            willChange: 'transform',
            backfaceVisibility: 'hidden'
          }}
        >
          <RotateCw className="w-5 h-5" />
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