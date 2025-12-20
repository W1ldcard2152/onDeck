'use client'

import React from 'react';
import { Home, CheckSquare, BookOpen, FolderOpen, ListChecks, Quote, Film, Star, Menu, Lightbulb, Users } from 'lucide-react';
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { NavProps, SectionType } from './types';

// Shared navigation items configuration
export const navItems: Array<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  id: SectionType;
}> = [
  { icon: Home, label: 'Dashboard', id: 'dashboard' },
  { icon: CheckSquare, label: 'Tasks', id: 'tasks' },
  { icon: BookOpen, label: 'Notes', id: 'notes' },
  { icon: Lightbulb, label: 'Train of Thought', id: 'train-of-thought' },
  { icon: FolderOpen, label: 'Projects', id: 'projects' },
  { icon: Star, label: 'Habits', id: 'habits' },
  { icon: ListChecks, label: 'Checklists', id: 'checklists' },
  { icon: Users, label: 'Relationships', id: 'relationships' },
  { icon: Quote, label: 'Quotes', id: 'quotes' },
  { icon: Film, label: 'Media Vault', id: 'media-vault' },
];

export const BottomNav = ({ activeSection, onSectionChange }: NavProps) => {
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t px-2 pb-safe">
        <div className="flex justify-around">
          {navItems.slice(0, 4).map(({ icon: Icon, label, id }) => (
            <button
              key={id}
              onClick={() => onSectionChange(id)}
              className={cn(
                "flex flex-col items-center py-2 px-3 rounded-lg",
                activeSection === id ? "text-blue-600" : "text-gray-600"
              )}
            >
              <Icon className="h-6 w-6" />
              <span className="text-xs mt-1">{label}</span>
            </button>
          ))}
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center py-2 px-3 rounded-lg text-gray-600">
                <Menu className="h-6 w-6" />
                <span className="text-xs mt-1">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-72">
              <div className="grid grid-cols-3 gap-4 p-4">
                {navItems.slice(4).map(({ icon: Icon, label, id }) => (
                  <button
                    key={id}
                    onClick={() => {
                      onSectionChange(id);
                      setIsSheetOpen(false);
                    }}
                    className={cn(
                      "flex flex-col items-center p-4 rounded-lg",
                      activeSection === id ? "text-blue-600 bg-blue-50" : "text-gray-600"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-sm mt-2">{label}</span>
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  );
};