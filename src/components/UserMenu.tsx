import React from 'react';
import { Settings } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

const UserMenu = () => {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { user } = useSupabaseAuth();
  
  const getInitials = () => {
    if (!user) return '?';
    
    // Try to get initials from user's email if no name is available
    const email = user.email || '';
    if (!user.user_metadata?.full_name) {
      return email.charAt(0).toUpperCase();
    }
    
    // Get initials from full name
    const fullName = user.user_metadata.full_name;
    return fullName
      .split(' ')
      .map((name: string) => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium hover:bg-blue-700 transition-colors">
          {getInitials()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {user?.email && (
          <div className="px-2 py-1.5 text-sm text-gray-500">
            {user.email}
          </div>
        )}
        <DropdownMenuItem onSelect={() => router.push('/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleSignOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;