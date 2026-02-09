'use client'

import React from 'react';
import { WifiOff, Loader2, Check } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

interface OfflineNotificationProps {
  className?: string;
  onSyncComplete?: () => void;
}

const OfflineNotification: React.FC<OfflineNotificationProps> = ({ className, onSyncComplete }) => {
  const { isOnline, pendingCount, isSyncing } = useOfflineSync({ onSyncComplete });
  const [showRestored, setShowRestored] = React.useState(false);
  const wasOfflineRef = React.useRef(false);

  React.useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
    } else if (wasOfflineRef.current && isOnline && !isSyncing && pendingCount === 0) {
      setShowRestored(true);
      wasOfflineRef.current = false;
      const timer = setTimeout(() => setShowRestored(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isSyncing, pendingCount]);

  // Nothing to show
  if (isOnline && !isSyncing && pendingCount === 0 && !showRestored) {
    return null;
  }

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 p-2 shadow-lg md:left-64 transition-transform ${
      isOnline ? (isSyncing ? 'bg-blue-500 text-white' : 'bg-green-500 text-green-900') : 'bg-yellow-500 text-yellow-900'
    } ${className}`}>
      <div className="flex items-center justify-center py-1">
        {!isOnline && (
          <>
            <WifiOff className="w-4 h-4 mr-2" />
            <span className="font-medium">
              You're offline.{pendingCount > 0 ? ` ${pendingCount} item${pendingCount !== 1 ? 's' : ''} waiting to sync.` : ' Some features may be limited.'}
            </span>
          </>
        )}
        {isOnline && isSyncing && (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            <span className="font-medium">
              Syncing {pendingCount} item{pendingCount !== 1 ? 's' : ''}...
            </span>
          </>
        )}
        {isOnline && !isSyncing && pendingCount > 0 && (
          <>
            <WifiOff className="w-4 h-4 mr-2" />
            <span className="font-medium">
              {pendingCount} item{pendingCount !== 1 ? 's' : ''} waiting to sync.
            </span>
          </>
        )}
        {showRestored && !isSyncing && pendingCount === 0 && (
          <>
            <Check className="w-4 h-4 mr-2" />
            <span className="font-medium">Connection restored! All items synced.</span>
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineNotification;
