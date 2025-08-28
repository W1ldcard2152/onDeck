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
      
      {/* Web Manifest */}
      <link rel="manifest" href="/manifest.json" />
      
      {/* Basic Favicon */}
      <link rel="icon" type="image/png" sizes="16x16" href="/icons/ios/16.png?v=2" />
      <link rel="icon" type="image/png" sizes="32x32" href="/icons/ios/32.png?v=2" />
      <link rel="icon" href="/favicon.ico?v=2" />
      
      {/* Apple iOS Icons */}
      <link rel="apple-touch-icon" href="/icons/ios/180.png?v=2" />
      <link rel="apple-touch-icon" sizes="57x57" href="/icons/ios/57.png?v=2" />
      <link rel="apple-touch-icon" sizes="60x60" href="/icons/ios/60.png?v=2" />
      <link rel="apple-touch-icon" sizes="72x72" href="/icons/ios/72.png?v=2" />
      <link rel="apple-touch-icon" sizes="76x76" href="/icons/ios/76.png?v=2" />
      <link rel="apple-touch-icon" sizes="114x114" href="/icons/ios/114.png?v=2" />
      <link rel="apple-touch-icon" sizes="120x120" href="/icons/ios/120.png?v=2" />
      <link rel="apple-touch-icon" sizes="144x144" href="/icons/ios/144.png?v=2" />
      <link rel="apple-touch-icon" sizes="152x152" href="/icons/ios/152.png?v=2" />
      <link rel="apple-touch-icon" sizes="167x167" href="/icons/ios/167.png?v=2" />
      <link rel="apple-touch-icon" sizes="180x180" href="/icons/ios/180.png?v=2" />
      
      {/* Apple Splash Screens */}
      <link rel="apple-touch-startup-image" href="/icons/SplashScreen.scale-100.png" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" />
      <link rel="apple-touch-startup-image" href="/icons/SplashScreen.scale-125.png" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" />
      <link rel="apple-touch-startup-image" href="/icons/SplashScreen.scale-150.png" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)" />
      <link rel="apple-touch-startup-image" href="/icons/SplashScreen.scale-200.png" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" />
      <link rel="apple-touch-startup-image" href="/icons/SplashScreen.scale-400.png" media="(min-device-width: 768px) and (max-device-width: 1024px)" />
      
      {/* Microsoft - Windows Tiles */}
      <meta name="msapplication-square70x70logo" content="/icons/windows11/SmallTile.scale-100.png" />
      <meta name="msapplication-square150x150logo" content="/icons/windows11/Square150x150Logo.scale-100.png" />
      <meta name="msapplication-wide310x150logo" content="/icons/windows11/Wide310x150Logo.scale-100.png" />
      <meta name="msapplication-square310x310logo" content="/icons/windows11/Square150x150Logo.scale-200.png" />
    </Head>
  );
};

export default PWAHead;