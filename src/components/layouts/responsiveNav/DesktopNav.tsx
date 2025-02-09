import React from 'react';
import { cn } from "@/lib/utils";
import { navItems } from '@/components/layouts/responsiveNav/BottomNav';
import type { NavProps } from '@/components/layouts/responsiveNav/types';

export const DesktopNav: React.FC<NavProps> = ({ activeSection, onSectionChange }) => {
  return (
    <div className="hidden md:block w-64 bg-navy-900 text-white p-4">
      <button 
        onClick={() => onSectionChange('dashboard')}
        className="flex items-center mb-8 hover:opacity-90 transition-opacity"
      >
        <div className="w-8 h-8 bg-blue-500 rounded-lg mr-2"></div>
        <span className="text-xl font-semibold">OnDeck</span>
      </button>

      <nav className="space-y-1">
        {navItems.map(({ icon: Icon, label, id }) => (
          <button
            key={id}
            onClick={() => onSectionChange(id)}
            className={cn(
              "flex w-full items-center px-3 py-2 rounded-lg text-sm",
              activeSection === id 
                ? "bg-blue-600 text-white" 
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            )}
          >
            <Icon className="h-5 w-5 mr-3" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
};