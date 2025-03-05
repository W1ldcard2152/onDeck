import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import PWAHead from '@/components/PWAHead';
import { useEffect } from 'react';

export default function App({ Component, pageProps }: AppProps) {
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