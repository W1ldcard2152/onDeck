'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.hostname !== 'localhost') {
      console.log('Service Worker is supported');
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          console.log('Service Worker registered successfully', reg);
        })
        .catch(err => {
          console.error('Service Worker registration failed', err);
        });
    } else {
      console.log('Service Worker is not supported or localhost detected');
    }
  }, [])

  // This component doesn't render anything
  return null
}