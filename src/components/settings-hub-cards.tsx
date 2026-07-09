
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserPlus, ShieldCheck, UserCog, Building, Images } from 'lucide-react';
import { SETTINGS_NAV_ITEMS } from '@/lib/settings-nav-items';

const cardDetails: Record<string, { icon: ReactNode; description: string; buttonText: string }> = {
  '/users': {
    icon: <Users className="h-5 w-5" />,
    description: 'Manage users, assign roles, activate/deactivate accounts, and manage access.',
    buttonText: 'Go to User Management',
  },
  '/users/new': {
    icon: <UserPlus className="h-5 w-5" />,
    description: 'Register a new user and assign their role and access permissions.',
    buttonText: 'Register New User',
  },
  '/roles': {
    icon: <ShieldCheck className="h-5 w-5" />,
    description: 'Create, edit, delete roles, and configure permissions.',
    buttonText: 'Go to Role Management',
  },
  '/staff': {
    icon: <UserCog className="h-5 w-5" />,
    description: 'Register and manage staff members assigned to branches or organizations.',
    buttonText: 'Go to Staff Management',
  },
  '/organization': {
    icon: <Building className="h-5 w-5" />,
    description: 'Manage branches, districts, regions, head office units, and organizational hierarchy.',
    buttonText: 'Go to Organization',
  },
  '/homeads': {
    icon: <Images className="h-5 w-5" />,
    description: 'Manage homepage banners, promotional images, and display order.',
    buttonText: 'Go to Homepage Carousel',
  },
};

interface SettingsHubCardsProps {
  basePath: string;
  hasPermission: (permission: string) => boolean;
}

export function SettingsHubCards({ basePath, hasPermission }: SettingsHubCardsProps) {
  const visibleCards = SETTINGS_NAV_ITEMS.filter((item) => hasPermission(item.permission)).map((item) => ({
    ...item,
    href: `${basePath}${item.path}`,
    ...cardDetails[item.path],
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {visibleCards.map((card) => (
        <Card key={card.title} className="flex flex-col">
          <CardHeader>
            <CardTitle>{card.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            <CardDescription>{card.description}</CardDescription>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full" style={{ backgroundColor: '#FBBF24', color: '#422006' }}>
              <Link href={card.href}>
                {card.icon}
                <span className="ml-2">{card.buttonText}</span>
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
      {visibleCards.length === 0 && (
        <p className="text-muted-foreground">You don&apos;t have access to any settings modules.</p>
      )}
    </div>
  );
}
