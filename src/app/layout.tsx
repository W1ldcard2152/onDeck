import { SearchProvider } from '@/contexts/SearchContext';
import DesktopLayout from '@/components/layouts/DesktopLayout';
import type { ReactNode } from 'react';
import '@/styles/globals.css';  // Add this import

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="en" className="light">
      <body className="min-h-screen bg-background font-sans antialiased">
        <DesktopLayout />
      </body>
    </html>
  );
}