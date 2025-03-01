import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import PWAHead from '@/components/PWAHead';
import { useEffect } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  // Register service worker
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Skip service worker registration in development
      if (process.env.NODE_ENV === 'production') {
        const registerSW = async () => {
          try {
            await navigator.serviceWorker.register('/sw.js');
            console.log('Service worker registered successfully');
          } catch (error) {
            console.error('Service worker registration failed:', error);
          }
        };
        
        registerSW();
      }
    }
  }, []);

  return (
    <>
      <PWAHead />
      <Component {...pageProps} />
    </>
  );
}