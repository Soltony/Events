
'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Settings, UserPlus, Users, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  const managementCards = [
    {
      title: 'User Registration',
      icon: <UserPlus className="h-5 w-5" />,
      description: 'Register new users for the application. Create new accounts. New users are created without any roles by default.',
      buttonText: 'Go to User Registration',
      href: '/dashboard/settings/users/new',
      color: '#FBBF24',
      textColor: '#422006'
    },
    {
      title: 'User Management',
      icon: <Users className="h-5 w-5" />,
      description: 'Manage user roles and the buildings they are assigned to. Assign roles and buildings to users to control access and responsibilities.',
      buttonText: 'Go to User Management',
      href: '/dashboard/settings/users',
      color: '#FBBF24',
      textColor: '#422006'
    },
    {
      title: 'Role Management',
      icon: <ShieldCheck className="h-5 w-5" />,
      description: 'Define roles and their permissions within the application. Create new roles, or edit existing ones to specify what actions users with that role can perform.',
      buttonText: 'Go to Role Management',
      href: '/dashboard/settings/roles',
      color: '#FBBF24',
      textColor: '#422006'
    }
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex items-center gap-4">
        <Settings className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Application Settings</h1>
          <p className="text-muted-foreground">
            Manage users and other application configurations.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {managementCards.map((card) => (
          <Card key={card.title} className="flex flex-col">
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
              <CardDescription>{card.description}</CardDescription>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full" style={{ backgroundColor: card.color, color: card.textColor }}>
                <Link href={card.href}>
                  {card.icon}
                  {card.buttonText}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
