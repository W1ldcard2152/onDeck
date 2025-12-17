import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta name="application-name" content="Sophia Praxis" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Sophia Praxis" />
        <meta name="description" content="Task, project, and note management application" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#ea580c" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#ea580c" />
        
        {/* PWA manifest - this is critical for installability */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Icons for various platforms */}
        <link rel="apple-touch-icon" href="/icons/ios/192.png?v=2" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/ios/32.png?v=2" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/ios/16.png?v=2" />
        <link rel="icon" href="/favicon.ico?v=2" />
        
        {/* Apple Icons */}
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/ios/152.png?v=2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/ios/180.png?v=2" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/ios/167.png?v=2" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}