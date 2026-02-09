'use client'

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Bell, Settings, MessageSquare } from 'lucide-react';
import { BottomNav } from './responsiveNav/BottomNav';
import { DesktopNav } from './responsiveNav/DesktopNav';
import { MobileHeader } from './responsiveNav/MobileHeader';
import AuthUI from '@/components/Auth';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import type { SectionType } from './responsiveNav/types';
import UserMenu from '../UserMenu';
import IntegratedSearch from '../IntegratedSearch';
import ClientLayout from './ClientLayout';
import InstallPWA from '../InstallPWA';
import OfflineNotification from '../OfflineNotification';
import PWANavigationBar from '../PWANavigationBar';
import { FeedbackModal } from '../FeedbackModal';

// Critical pages - loaded immediately for fast initial render
import DashboardPage from '@/app/dashboard/page';
import TasksPage from '@/app/tasks/page';

// Non-critical pages - lazy loaded on demand
const NotesPage = dynamic(() => import('@/app/notes/page'), {
  loading: () => <div className="flex items-center justify-center h-32"><div className="text-lg text-gray-500">Loading...</div></div>
});
const TrainOfThoughtPage = dynamic(() => import('@/app/train-of-thought/page'), {
  loading: () => <div className="flex items-center justify-center h-32"><div className="text-lg text-gray-500">Loading...</div></div>
});
const ProjectsPage = dynamic(() => import('@/app/projects/page'), {
  loading: () => <div className="flex items-center justify-center h-32"><div className="text-lg text-gray-500">Loading...</div></div>
});
const HabitsPage = dynamic(() => import('@/app/habits/page'), {
  loading: () => <div className="flex items-center justify-center h-32"><div className="text-lg text-gray-500">Loading...</div></div>
});
const ChecklistsPage = dynamic(() => import('@/app/checklists/page'), {
  loading: () => <div className="flex items-center justify-center h-32"><div className="text-lg text-gray-500">Loading...</div></div>
});
const FeedbackPage = dynamic(() => import('@/app/feedback/page'), {
  loading: () => <div className="flex items-center justify-center h-32"><div className="text-lg text-gray-500">Loading...</div></div>
});
const QuotesPage = dynamic(() => import('@/app/quotes/page'), {
  loading: () => <div className="flex items-center justify-center h-32"><div className="text-lg text-gray-500">Loading...</div></div>
});
const RelationshipsPage = dynamic(() => import('@/app/relationships/page'), {
  loading: () => <div className="flex items-center justify-center h-32"><div className="text-lg text-gray-500">Loading...</div></div>
});
const CatalogPage = dynamic(() => import('@/app/catalog/page'), {
  loading: () => <div className="flex items-center justify-center h-32"><div className="text-lg text-gray-500">Loading...</div></div>
});
const ProtocolsPage = dynamic(() => import('@/app/protocols/page'), {
  loading: () => <div className="flex items-center justify-center h-32"><div className="text-lg text-gray-500">Loading...</div></div>
});

const DesktopLayout = () => {
  const { user, loading } = useSupabaseAuth();
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isInPWA, setIsInPWA] = useState(false);

  // Initialize active section from sessionStorage (persists on minimize) or default to dashboard
  const [activeSection, setActiveSection] = useState<SectionType>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('sophia-praxis-active-section');
      return (saved as SectionType) || 'dashboard';
    }
    return 'dashboard';
  });
  
  // Memoize service worker options to prevent re-registration
  const serviceWorkerOptions = useMemo(() => ({
    onSuccess: (registration: ServiceWorkerRegistration) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Service worker registered successfully in DesktopLayout:', registration);
      }
    },
    onUpdate: (registration: ServiceWorkerRegistration) => {
      // When there's an update to the service worker, notify the user
      console.log('New content is available; please refresh.');
      
      // Show notification if permissions are granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Sophia Praxis Update Available', {
          body: 'New features are available. Refresh to update.',
          icon: '/icons/icon-192x192.png'
        });
      }
    },
    onError: (err: Error) => {
      console.error('Service worker registration failed in DesktopLayout:', err);
    }
  }), []);

  // Register and monitor the service worker
  const { isActive, isRegistered, error } = useServiceWorker(serviceWorkerOptions);

  // Save active section to sessionStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('sophia-praxis-active-section', activeSection);
    }
  }, [activeSection]);

  // Check if running as PWA
  useEffect(() => {
    const checkPWAStatus = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      setIsInPWA(isStandalone);
    };
    
    checkPWAStatus();
    
    // Also check when display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => checkPWAStatus();
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    }
    
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      }
    };
  }, []);
  
  // Log service worker status in development
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Service worker status in DesktopLayout:', {
        isActive,
        isRegistered,
        error: error?.message,
        isInPWA
      });
    }
  }, [isActive, isRegistered, error, isInPWA]);

  // Preload non-critical page chunks in the background after initial render
  // This caches them so navigation is instant when user clicks on those sections
  useEffect(() => {
    if (!user || loading) return;

    // Wait a bit after initial render to ensure critical path is complete
    const preloadTimer = setTimeout(() => {
      // Preload all dynamic page components in the background
      // These will be cached by the browser, making navigation instant
      const preloadPages = async () => {
        try {
          // Stagger the imports slightly to avoid network congestion
          await Promise.all([
            import('@/app/notes/page'),
            import('@/app/projects/page'),
            import('@/app/habits/page'),
          ]);

          // Load second tier after a small delay
          setTimeout(async () => {
            await Promise.all([
              import('@/app/checklists/page'),
              import('@/app/protocols/page'),
              import('@/app/quotes/page'),
              import('@/app/relationships/page'),
              import('@/app/catalog/page'),
              import('@/app/train-of-thought/page'),
              import('@/app/feedback/page'),
            ]);
          }, 1000);
        } catch (err) {
          // Silently fail - these are just optimizations
          console.log('Background page preload failed (non-critical):', err);
        }
      };

      preloadPages();
    }, 2000); // Wait 2 seconds after initial render

    return () => clearTimeout(preloadTimer);
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthUI />;
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardPage />;
      case 'tasks':
        return <TasksPage />;
      case 'notes':
        return <NotesPage />;
      case 'train-of-thought':
        return <TrainOfThoughtPage />;
      case 'projects':
        return <ProjectsPage />;
      case 'habits':
        return <HabitsPage />;
      case 'checklists':
        return <ChecklistsPage />;
      case 'quotes':
        return <QuotesPage />;
      case 'relationships':
        return <RelationshipsPage />;
      case 'catalog':
        return <CatalogPage />;
      case 'protocols':
        return <ProtocolsPage />;
      case 'feedback':
        return <FeedbackPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <ClientLayout>
      <div className="min-h-screen bg-gray-50">
        {/* PWA Navigation Bar - shows only in PWA mode */}
        <PWANavigationBar onHomeClick={() => setActiveSection('dashboard')} />
        
        {/* Desktop Navigation - hidden on mobile, adjust for PWA nav bar */}
        <div className={`hidden md:block fixed left-0 h-full ${isInPWA ? 'top-12' : 'top-0'}`}>
          <DesktopNav 
            activeSection={activeSection} 
            onSectionChange={setActiveSection}
          />
        </div>

        {/* Main Content Area - adjust padding for PWA nav bar */}
        <div className={`md:pl-64 flex-1 flex flex-col min-w-0 ${isInPWA ? 'pt-12' : ''}`}>
          {/* Mobile Header */}
          <MobileHeader 
            className="md:hidden" 
            onSectionChange={setActiveSection}
            onFeedbackClick={() => setIsFeedbackModalOpen(true)}
          />
          
          {/* Install PWA Prompt - Only visible on mobile */}
          <div className="md:hidden px-4 mt-16">
            <InstallPWA />
          </div>

          {/* Desktop Header */}
          <header className="hidden md:flex h-16 bg-white border-b items-center justify-between px-4">
            <div className="flex items-center flex-1">
              <IntegratedSearch 
                className="max-w-md" 
                onSectionChange={setActiveSection}
                activeSection={activeSection}
              />
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Desktop Install Button */}
              <div className="hidden md:block w-auto mr-2">
                <InstallPWA />
              </div>
              <button 
                type="button"
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => setIsFeedbackModalOpen(true)}
              >
                <MessageSquare size={20} className="text-red-500" />
              </button>
              <button 
                type="button"
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Bell size={20} className="text-gray-600" />
              </button>
              <button 
                type="button"
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Settings size={20} className="text-gray-600" />
              </button>
              <UserMenu />
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-6 mt-16 md:mt-0 pb-20 md:pb-6">
            <div className="max-w-7xl mx-auto">
              {renderContent()}
            </div>
          </main>

          {/* Bottom Navigation - visible only on mobile */}
          <BottomNav 
            activeSection={activeSection} 
            onSectionChange={setActiveSection}
          />
        </div>
      </div>
      
      {/* Offline notification */}
      <OfflineNotification />
      
      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onOpenChange={setIsFeedbackModalOpen}
        onViewAllFeedback={() => setActiveSection('feedback')}
      />
    </ClientLayout>
  );
};

export default DesktopLayout;