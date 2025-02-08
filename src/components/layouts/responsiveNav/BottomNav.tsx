import React from 'react';
import { Home, CheckSquare, BookOpen, FolderOpen, Calendar, Star, Menu } from 'lucide-react';
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

interface NavProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

// Shared navigation items configuration
export const navItems = [
  { icon: Home, label: 'Dashboard', id: 'dashboard' },
  { icon: CheckSquare, label: 'Tasks', id: 'tasks' },
  { icon: BookOpen, label: 'Notes', id: 'notes' },
  { icon: FolderOpen, label: 'Projects', id: 'projects' },
  { icon: Star, label: 'Habits', id: 'habits' },
  { icon: Calendar, label: 'Journal', id: 'journal' },
];

export const BottomNav: React.FC<NavProps> = ({ activeSection, onSectionChange }) => {
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
          <Sheet>
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
                      // Close sheet (you'll need to implement this)
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