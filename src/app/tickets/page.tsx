'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpRight, Ticket } from 'lucide-react';
import api from '@/lib/api';
import { getTicketsForUser } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

console.log("### MyTicketsPage component file loaded ###");

interface Event {
  id: string;
  name: string;
  image: string | null;
  startDate: Date;
  endDate: Date | null;
}

interface TicketType {
  id: string;
  name: string;
}

interface Attendee {
  id: string;
  userId: string | null;
  phoneNumber: string | null;
  createdAt: Date;
  qrCode: string;
  event: Event;
  ticketType: TicketType;
}

const DEFAULT_IMAGE_PLACEHOLDER = '/images/nibtickets.jpg';

function formatEventDate(startDate: Date, endDate: Date | null | undefined): string {
  const startDateFormat = 'LLL dd, y, hh:mm a';
  if (endDate) {
    const endDateFormat =
      format(new Date(endDate), 'LLL dd, y') === format(new Date(startDate), 'LLL dd, y')
        ? 'hh:mm a'
        : startDateFormat;
    return `${''}${format(new Date(startDate), startDateFormat)} - ${format(new Date(endDate), endDateFormat)}`;
  }
  return format(new Date(startDate), startDateFormat);
}

export default function MyTicketsPage() {
  console.log("### MyTicketsPage render START ###");

  const [tickets, setTickets] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading } = useAuth();

  console.log("Render values → user:", user, "isAuthLoading:", isAuthLoading);

  useEffect(() => {
    console.log("### useEffect triggered ###");

    async function fetchTickets() {
      console.log(">>> fetchTickets called");
      console.log("Auth loading:", isAuthLoading, "User:", user);

      if (isAuthLoading) {
        console.log("Auth is still loading → stopping fetchTickets");
        return;
      }

      setLoading(true);

      try {
        if (user) {
          console.log("Logged in user detected → fetching tickets for userId:", user.id);

          const fetchedTickets = await getTicketsForUser(user.id, user.phoneNumber || undefined);

          console.log("Fetched tickets for logged-in user:", fetchedTickets);
          setTickets(fetchedTickets);
          return;
        }

        // Guest user flow
        console.log("No user found → checking /api/auth/cookie-data");
        const response = await api.get('/api/auth/cookie-data');

        console.log("Cookie data response:", response);

        const phoneNumber = response.data?.data?.phoneNumber;
        console.log("Guest phone number:", phoneNumber);

        if (!phoneNumber) {
          console.log("No guest phone number found.");
          setTickets([]);
          return;
        }

        console.log("Fetching guest tickets with phone:", phoneNumber);
        const fetchedTickets = await getTicketsForUser(undefined, phoneNumber);

        console.log("Fetched guest tickets:", fetchedTickets);
        setTickets(fetchedTickets);

      } catch (error) {
        console.error("❌ ERROR while fetching tickets:", error);
        toast({
          variant: "destructive",
          title: "Could not load tickets",
          description: "There was a problem retrieving your tickets. Please try again later.",
        });
        setTickets([]);
      } finally {
        console.log(">>> fetchTickets FINISHED");
        setLoading(false);
      }
    }

    fetchTickets();
  }, [toast, user, isAuthLoading]);

  console.log("### MyTicketsPage render END ###");

  if (loading) {
    console.log("Render → loading state...");
    return (
      <div>Loading...</div>
    );
  }

  console.log("Render → Loaded. Tickets length:", tickets.length);

  return (
    <div>
      <h1>My Tickets</h1>
    </div>
  );
}
