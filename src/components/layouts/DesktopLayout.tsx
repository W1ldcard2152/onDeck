'use client'

import React, { useState, useEffect } from 'react';
import { Bell, Settings } from 'lucide-react';
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
import InstallPWA from '../InstallPWA';
import PWAStatus from '../PWAStatus';
import OfflineNotification from '../OfflineNotification';

const DesktopLayout = () => {
  const { user, loading } = useSupabaseAuth();
  const [activeSection, setActiveSection] = useState<SectionType>('dashboard');
  
  // Register and monitor the service worker
  const { isActive, isRegistered, error } = useServiceWorker({
    onSuccess: (registration) => {
      console.log('Service worker registered successfully in DesktopLayout:', registration);
    },
    onUpdate: (registration) => {
      // When there's an update to the service worker, we can notify the user
      console.log('New content is available; please refresh.');
      
      // Optionally show a toast/notification to the user
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('OnDeck Update Available', {
          body: 'New features are available. Refresh to update.',
          icon: '/icons/icon-192x192.png'
        });
      }
    },
    onError: (err) => {
      console.error('Service worker registration failed in DesktopLayout:', err);
    }
  });
  
  // Log service worker status in development
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Service worker status in DesktopLayout:', { 
        isActive, 
        isRegistered,
        error: error?.message
      });
    }
  }, [isActive, isRegistered, error]);

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
        return <div className="text-center py-12">Habits feature coming soon</div>;
      case 'journal':
        return <div className="text-center py-12">Journal feature coming soon</div>;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <ClientLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Desktop Navigation - hidden on mobile */}
        <div className="hidden md:block fixed left-0 top-0 h-full">
          <DesktopNav 
            activeSection={activeSection} 
            onSectionChange={setActiveSection}
          />
        </div>

        {/* Main Content Area */}
        <div className="md:pl-64 flex-1 flex flex-col min-w-0">
          {/* Mobile Header */}
          <MobileHeader 
            className="md:hidden" 
            onSectionChange={setActiveSection}
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
    </ClientLayout>
  );
};

export default DesktopLayout;