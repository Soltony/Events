
'use client';

import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/auth-context";
import { useSidebar } from '@/components/ui/sidebar';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export function UserNav() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { state, toggleSidebar } = useSidebar();


  const handleLogout = async () => {
    await logout();
  };
  
  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
        return `${user.firstName[0]}${user.lastName[0]}`;
    }
    return 'U';
  }

  return (
    <div className={cn("flex w-full items-center", state === 'collapsed' ? 'justify-center' : 'justify-between')}>
       <div className={cn('flex items-center gap-2', state === 'collapsed' && 'hidden')}>
            <Avatar className="h-9 w-9">
              <AvatarImage src="https://placehold.co/40x40.png" alt="@user" data-ai-hint="profile person" />
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
            {user && (
                <div className="flex flex-col">
                    <span className="text-sm font-medium leading-none">{user.firstName} {user.lastName}</span>
                    <span className="text-xs leading-none text-muted-foreground">{user.phoneNumber}</span>
                </div>
            )}
        </div>
       <DropdownMenu>
        <DropdownMenuTrigger asChild>
             <Button variant="ghost" size="icon" className={cn(state === 'expanded' && 'w-8 h-8')}>
                <ChevronLeft className="h-5 w-5 transition-transform duration-300 group-data-[state=expanded]/sidebar-wrapper:rotate-180" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
              {user ? (
                  <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.firstName} {user.lastName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                      {user.phoneNumber}
                      </p>
                  </div>
              ) : (
                   <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">Organizer</p>
                      <p className="text-xs leading-none text-muted-foreground">
                          Not logged in
                      </p>
                  </div>
              )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push('/dashboard')}>Dashboard</DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>Settings</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => {
            handleLogout();
            toggleSidebar(); // Collapse sidebar on logout
          }}>
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
