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
const navItems = [
  { icon: Home, label: 'Dashboard', id: 'dashboard' },
  { icon: CheckSquare, label: 'Tasks', id: 'tasks' },
  { icon: BookOpen, label: 'Notes', id: 'notes' },
  { icon: FolderOpen, label: 'Projects', id: 'projects' },
  { icon: Star, label: 'Habits', id: 'habits' },
  { icon: Calendar, label: 'Journal', id: 'journal' },
];

const MobileNav = ({ activeSection, onSectionChange }: NavProps) => {
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

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center px-4">
        <div className="flex items-center flex-1">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-500 rounded-lg mr-2"></div>
            <span className="text-xl font-semibold">OnDeck</span>
          </div>
        </div>
      </header>
    </>
  );
};

const DesktopNav = ({ activeSection, onSectionChange }: NavProps) => {
  return (
    <div className="hidden md:block w-64 bg-navy-900 text-white p-4">
      <div className="flex items-center mb-8">
        <div className="w-8 h-8 bg-blue-500 rounded-lg mr-2"></div>
        <span className="text-xl font-semibold">OnDeck</span>
      </div>

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

export const ResponsiveNavigation: React.FC<NavProps> = ({ 
  activeSection, 
  onSectionChange 
}) => {
  return (
    <>
      <MobileNav activeSection={activeSection} onSectionChange={onSectionChange} />
      <DesktopNav activeSection={activeSection} onSectionChange={onSectionChange} />
    </>
  );
};

export default ResponsiveNavigation;