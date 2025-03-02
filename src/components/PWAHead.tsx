import React from 'react';
import Head from 'next/head';

interface PWAHeadProps {
  title?: string;
  description?: string;
}

const PWAHead: React.FC<PWAHeadProps> = ({ 
  title = 'OnDeck', 
  description = 'Task, project, and note management application' 
}) => {
  return (
    <Head>
      <title>{title}</title>
      
      {/* Meta Tags */}
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      <meta name="description" content={description} />
      
      {/* PWA Meta Tags */}
      <meta name="application-name" content="OnDeck" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="OnDeck" />
      <meta name="format-detection" content="telephone=no" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="msapplication-config" content="/browserconfig.xml" />
      <meta name="msapplication-TileColor" content="#2563eb" />
      <meta name="msapplication-tap-highlight" content="no" />
      <meta name="theme-color" content="#2563eb" />
      
      {/* Icons */}
      <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />
      <link rel="icon" href="/favicon.ico" />
      <link rel="manifest" href="/manifest.json" />
      
      {/* Apple Specific */}
      <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png" />
      <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-167x167.png" />
      
      {/* Apple Splash Screens */}
      <link rel="apple-touch-startup-image" href="/splash/apple-splash-2048-2732.png" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
      <link rel="apple-touch-startup-image" href="/splash/apple-splash-1668-2388.png" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
      <link rel="apple-touch-startup-image" href="/splash/apple-splash-1536-2048.png" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
      <link rel="apple-touch-startup-image" href="/splash/apple-splash-1125-2436.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
      <link rel="apple-touch-startup-image" href="/splash/apple-splash-1242-2688.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
      <link rel="apple-touch-startup-image" href="/splash/apple-splash-828-1792.png" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
      <link rel="apple-touch-startup-image" href="/splash/apple-splash-750-1334.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
      <link rel="apple-touch-startup-image" href="/splash/apple-splash-640-1136.png" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
      
      {/* Service Worker Registration Script */}
      <script src="/next-pwa-setup.js" defer></script>
    </Head>
  );
};

export default PWAHead;