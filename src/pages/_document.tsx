import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta name="application-name" content="OnDeck" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="OnDeck" />
        <meta name="description" content="Task, project, and note management application" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#2563eb" />
        
        {/* PWA manifest - this is critical for installability */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Icons for various platforms */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Apple Icons */}
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-167x167.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
        
        {/* Add PWA setup script - this registers the service worker */}
        <script dangerouslySetInnerHTML={{
          __html: `
            // Check if service workers are supported
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(registration) {
                    console.log('PWA: ServiceWorker registration successful with scope: ', registration.scope);
                  })
                  .catch(function(err) {
                    console.log('PWA: ServiceWorker registration failed: ', err);
                  });
              });
            }
          `
        }} />
      </body>
    </Html>
  )
}