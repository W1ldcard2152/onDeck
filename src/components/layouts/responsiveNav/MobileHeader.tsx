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
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

interface MobileHeaderProps {
  className?: string;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({ className }) => {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const supabase = createClientComponentClient();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  // Expanded search view
  if (isSearchExpanded) {
    return (
      <header className={cn(
        "fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center px-4 z-20",
        className
      )}>
        <div className="flex items-center flex-1 gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100"
              autoFocus
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSearchExpanded(false)}
          >
            <X className="h-5 w-5 text-gray-600" />
          </Button>
        </div>
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
      <div className="flex items-center">
        <div className="w-8 h-8 bg-blue-500 rounded-lg mr-2"></div>
        <span className="text-xl font-semibold">OnDeck</span>
      </div>

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
            >
              <div className="w-7 h-7 bg-gray-200 rounded-full" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleSignOut}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default MobileHeader;