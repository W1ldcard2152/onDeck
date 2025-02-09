import React, { useState } from 'react';
import { Search, Bell, Settings, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import UserMenu from '@/components/UserMenu';
import { SearchInput } from '@/components/SearchInput';
import type { SectionType } from './types';

interface MobileHeaderProps {
  className?: string;
  onSectionChange?: (section: SectionType) => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ 
  className,
  onSectionChange 
}) => {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Expanded search view
  if (isSearchExpanded) {
    return (
      <header className={cn(
        "fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center px-4 z-20",
        className
      )}>
        <SearchInput
          mobile
          expanded={isSearchExpanded}
          onExpandedChange={setIsSearchExpanded}
          onSectionChange={onSectionChange}
          className="flex-1"
        />
      </header>
    );
  }

  // Default header view
  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center justify-between px-4 z-20",
      className
    )}>
      {/* Logo */}
      <button 
        onClick={() => onSectionChange?.('dashboard')}
        className="flex items-center hover:opacity-90 transition-opacity"
      >
        <div className="w-8 h-8 bg-blue-500 rounded-lg mr-2"></div>
        <span className="text-xl font-semibold">OnDeck</span>
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          onClick={() => setIsSearchExpanded(true)}
        >
          <Search className="h-5 w-5 text-gray-600" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
        >
          <Bell className="h-5 w-5 text-gray-600" />
        </Button>

        <UserMenu />
      </div>
    </header>
  );
};