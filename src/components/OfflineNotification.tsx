'use client'

import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

interface OfflineNotificationProps {
  className?: string;
}

const OfflineNotification: React.FC<OfflineNotificationProps> = ({ className }) => {
  const [isOffline, setIsOffline] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    // Check initial state
    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }

    // Add event listeners
    const handleOffline = () => {
      setIsOffline(true);
      setShowNotification(true);
    };

    const handleOnline = () => {
      setIsOffline(false);
      // Keep the notification visible for a moment after reconnecting
      setTimeout(() => {
        setShowNotification(false);
      }, 3000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Don't render anything if online
  if (!isOffline && !showNotification) {
    return null;
  }

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 p-2 bg-yellow-500 text-yellow-900 shadow-lg md:left-64 transition-transform ${className}`}>
      <div className="flex items-center justify-center py-1">
        <WifiOff className="w-4 h-4 mr-2" />
        <span className="font-medium">
          {isOffline 
            ? "You are currently offline. Some features may be limited." 
            : "Connection restored! Your changes will be synced."}
        </span>
      </div>
    </div>
  );
};

export default OfflineNotification;