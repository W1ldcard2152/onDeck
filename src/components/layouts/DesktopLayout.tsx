'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { Bell, Settings, MessageSquare } from 'lucide-react';
import { BottomNav } from './responsiveNav/BottomNav';
import { DesktopNav } from './responsiveNav/DesktopNav';
import { MobileHeader } from './responsiveNav/MobileHeader';
import AuthUI from '@/components/Auth';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import type { SectionType } from './responsiveNav/types';
import DashboardPage from '@/app/dashboard/page';
import TasksPage from '@/app/tasks/page';
import NotesPage from '@/app/notes/page';
import UserMenu from '../UserMenu';
import IntegratedSearch from '../IntegratedSearch';
import ClientLayout from './ClientLayout';
import ProjectsPage from '@/app/projects/page';
import HabitsPage from '@/app/habits/page';
import ChecklistsPage from '@/app/checklists/page';
import FeedbackPage from '@/app/feedback/page';
import QuotesPage from '@/app/quotes/page';
import InstallPWA from '../InstallPWA';
import PWAStatus from '../PWAStatus';
import OfflineNotification from '../OfflineNotification';
import PWANavigationBar from '../PWANavigationBar';
import { FeedbackModal } from '../FeedbackModal';

const DesktopLayout = () => {
  const { user, loading } = useSupabaseAuth();
  const [activeSection, setActiveSection] = useState<SectionType>('dashboard');
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isInPWA, setIsInPWA] = useState(false);
  
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
        new Notification('OnDeck Update Available', {
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
      case 'projects':
        return <ProjectsPage />;
      case 'habits':
        return <HabitsPage />;
      case 'checklists':
        return <ChecklistsPage />;
      case 'quotes':
        return <QuotesPage />;
      case 'media-vault':
        return <div className="text-center py-12">Media Vault feature coming soon</div>;
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
      
      {/* PWA Status Debug (visible in development) */}
      <PWAStatus showDebug={process.env.NODE_ENV === 'development'} />
      
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