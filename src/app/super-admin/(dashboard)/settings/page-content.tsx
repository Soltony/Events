
'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Settings, Users, UserPlus, ShieldCheck, UserCog, Building, Images } from 'lucide-react';
import { useSuperAdminAuth } from '@/context/super-admin-auth-context';

const managementCards = [
  {
    title: 'User Management',
    icon: <Users className="h-5 w-5" />,
    description: 'Manage users, assign roles, activate/deactivate accounts, and manage access.',
    buttonText: 'Go to User Management',
    href: '/super-admin/users',
    permission: 'Users:Read',
  },
  {
    title: 'User Registration',
    icon: <UserPlus className="h-5 w-5" />,
    description: 'Register a new user and assign their role and access permissions.',
    buttonText: 'Register New User',
    href: '/super-admin/users/new',
    permission: 'Users:Create',
  },
  {
    title: 'Role Management',
    icon: <ShieldCheck className="h-5 w-5" />,
    description: 'Create, edit, delete roles, and configure permissions.',
    buttonText: 'Go to Role Management',
    href: '/super-admin/roles',
    permission: 'Roles:Read',
  },
  {
    title: 'Staff Management',
    icon: <UserCog className="h-5 w-5" />,
    description: 'Register and manage staff members assigned to branches or organizations.',
    buttonText: 'Go to Staff Management',
    href: '/super-admin/staff',
    permission: 'Staff:Read',
  },
  {
    title: 'Organization',
    icon: <Building className="h-5 w-5" />,
    description: 'Manage branches, districts, regions, head office units, and organizational hierarchy.',
    buttonText: 'Go to Organization',
    href: '/super-admin/organization',
    permission: 'Organization:Read',
  },
  {
    title: 'Homepage Carousel',
    icon: <Images className="h-5 w-5" />,
    description: 'Manage homepage banners, promotional images, and display order.',
    buttonText: 'Go to Homepage Carousel',
    href: '/super-admin/homeads',
    permission: 'Homepage Carousel:Read',
  },
];

export default function SettingsPageContent() {
  const { hasPermission } = useSuperAdminAuth();

  const visibleCards = managementCards.filter((card) => hasPermission(card.permission));

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex items-center gap-4">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage users, roles, staff, organization, and homepage content.
          </p>
        </div>
      </div>

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
    </div>
  );
}
