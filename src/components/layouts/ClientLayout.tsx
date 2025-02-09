'use client'

import { SearchProvider } from '@/contexts/SearchContext';
import type { ReactNode } from 'react';

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <SearchProvider>
      {children}
    </SearchProvider>
  );
}