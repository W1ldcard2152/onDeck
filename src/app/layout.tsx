import { SearchProvider } from '@/contexts/SearchContext';
import DesktopLayout from '@/components/layouts/DesktopLayout';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OnDeck',
  description: 'Task, project, and note management application',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/ios/16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/ios/32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/ios/192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/ios/512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [
      { url: '/icons/ios/180.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/ios/152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/ios/144.png', sizes: '144x144', type: 'image/png' },
      { url: '/icons/ios/120.png', sizes: '120x120', type: 'image/png' }
    ]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'OnDeck'
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="en" className="light">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}