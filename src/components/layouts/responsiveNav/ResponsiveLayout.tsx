import React, { useState } from 'react';
import { Search, Bell, Settings, MessageSquare } from 'lucide-react';
import { cn } from "@/lib/utils";
import { BottomNav } from './BottomNav';
import { DesktopNav } from './DesktopNav';
import { MobileHeader } from './MobileHeader';
import { FeedbackModal } from '@/components/FeedbackModal';
import type { SectionType } from './types';

const Layout = () => {
  const [activeSection, setActiveSection] = useState<SectionType>('dashboard');
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Navigation - hidden on mobile */}
      <div className="hidden md:block fixed left-0 top-0 h-full">
        <DesktopNav 
          activeSection={activeSection} 
          onSectionChange={setActiveSection}
        />
      </div>

      {/* Main Content Area */}
      <div className="md:ml-64 min-h-screen flex flex-col">
        {/* Mobile Header - visible only on mobile */}
        <MobileHeader 
          className="md:hidden"
          onSectionChange={setActiveSection}
          onFeedbackClick={() => setIsFeedbackModalOpen(true)}
        />

        {/* Desktop Header - visible only on desktop */}
        <header className="hidden md:flex h-16 bg-white border-b items-center justify-between px-4 sticky top-0">
          <div className="flex items-center flex-1">
            <div className="relative w-full max-w-md">
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              className="p-2 hover:bg-gray-100 rounded-lg"
              onClick={() => setIsFeedbackModalOpen(true)}
            >
              <MessageSquare size={20} className="text-red-500" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <Bell size={20} className="text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <Settings size={20} className="text-gray-600" />
            </button>
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 mt-16 md:mt-0 pb-20 md:pb-6">
          {/* Your page content goes here */}
          <div className="max-w-7xl mx-auto">
            {/* Content for each section */}
            {activeSection === 'dashboard' && <div>Dashboard Content</div>}
            {activeSection === 'tasks' && <div>Tasks Content</div>}
            {activeSection === 'notes' && <div>Notes Content</div>}
            {activeSection === 'projects' && <div>Projects Content</div>}
            {activeSection === 'habits' && <div>Habits Content</div>}
            {activeSection === 'checklists' && <div>Checklists Content</div>}
            {activeSection === 'quotes' && <div>Quotes Content</div>}
            {activeSection === 'media-vault' && <div>Media Vault Content</div>}
            {activeSection === 'feedback' && <div>Feedback Content</div>}
          </div>
        </main>

        {/* Bottom Navigation - visible only on mobile */}
        <BottomNav 
          activeSection={activeSection} 
          onSectionChange={setActiveSection}
        />
      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onOpenChange={setIsFeedbackModalOpen}
      />
    </div>
  );
};

export default Layout;