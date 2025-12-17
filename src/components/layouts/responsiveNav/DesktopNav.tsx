import React from 'react';
import Image from 'next/image';
import { Zap } from 'lucide-react';
import { cn } from "@/lib/utils";
import { navItems } from '@/components/layouts/responsiveNav/BottomNav';
import type { NavProps } from '@/components/layouts/responsiveNav/types';

export const DesktopNav: React.FC<NavProps> = ({ activeSection, onSectionChange }) => {
  return (
    <div className="h-full">
      <div className="fixed inset-y-0 left-0 w-64 bg-orange-300 text-slate-900 p-4">
        <div className="flex justify-center mb-6">
          <Image
            src="/images/logo.png"
            alt="Sophia Logo"
            width={120}
            height={120}
          />
        </div>

        <div className="flex items-center gap-2 px-3 py-3 mb-3 border-b border-orange-600">
          <Zap className="h-6 w-6 text-slate-700" fill="currentColor" />
          <span className="text-2xl text-slate-700 font-bold leading-none">Praxis</span>
        </div>

        <nav className="space-y-1">
          {navItems.map(({ icon: Icon, label, id }) => (
            <button
              key={id}
              onClick={() => onSectionChange(id)}
              className={cn(
                "flex w-full items-center px-3 py-2 rounded-lg text-sm",
                activeSection === id
                  ? "bg-slate-700 text-white"
                  : "text-slate-900 hover:bg-orange-600 hover:text-slate-900"
              )}
            >
              <Icon className="h-5 w-5 mr-3" />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};