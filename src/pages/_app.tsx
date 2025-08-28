import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import PWAHead from '@/components/PWAHead';
import { useEffect } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Debug PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('💡 beforeinstallprompt fired!', e);
    };
    
    const handleAppInstalled = () => {
      console.log('💡 App was installed successfully!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Register service worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
          .then(function(registration) {
            console.log('Service worker registered successfully:', registration.scope);
          })
          .catch(function(error) {
            console.error('Service worker registration failed:', error);
          });
      });
    }
  }, []);

  return (
    <>
      <PWAHead />
      <Component {...pageProps} />
    </>
  );
}