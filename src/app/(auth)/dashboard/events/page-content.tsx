
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, ArrowUpRight, Pencil, Trash2, MapPin, Loader2, User, Search, FileDown } from "lucide-react";
import Link from 'next/link';
import Image from 'next/image';
import { getEvents, deleteEvent } from '@/lib/actions';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { Event as EventType, User as UserType } from '@prisma/client';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';
import { getPrimaryEventImage } from '@/lib/event-images';

interface EventWithOrganizer extends EventType {
  organizer?: Partial<UserType>;
}

const DEFAULT_IMAGE_PLACEHOLDER = '/images/nibtickets.jpg';

function formatEventDate(startDate: Date, endDate: Date | null | undefined): string {
    const startDateFormat = 'LLL dd, y, hh:mm a';
    
    if (endDate) {
      const endDateFormat = format(new Date(endDate), 'LLL dd, y') === format(new Date(startDate), 'LLL dd, y') 
        ? 'hh:mm a'
        : startDateFormat;
      return `${''}${format(new Date(startDate), startDateFormat)} - ${''}${format(new Date(endDate), endDateFormat)}`;
    }
    return format(new Date(startDate), startDateFormat);
}

const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'Technology':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Music':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Art':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'Community':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Business':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
}

function convertEventsToCSV(events: EventWithOrganizer[]): string {
    const headers = ['Name', 'Category', 'Status', 'Start Date', 'End Date', 'Location', 'Creator', 'Rejection Reason'];
    const rows = events.map((event) => {
        const organizerName = event.organizer
            ? `${event.organizer.firstName ?? ''} ${event.organizer.lastName ?? ''}`.trim()
            : '';
        const values = [
            event.name,
            event.category,
            event.status ?? '',
            format(new Date(event.startDate), 'yyyy-MM-dd HH:mm'),
            event.endDate ? format(new Date(event.endDate), 'yyyy-MM-dd HH:mm') : '',
            event.location.replace(/\|\|/g, ', '),
            organizerName,
            event.rejectionReason ?? '',
        ];
        return values.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
    });
    return [headers.join(','), ...rows].join('\n');
}

const EventCard = ({ event, onDelete }: { event: EventWithOrganizer, onDelete: (e: EventWithOrganizer) => void }) => {
    const { hasPermission } = useAuth();
    const displayImage = getPrimaryEventImage(event.image) || DEFAULT_IMAGE_PLACEHOLDER;

    const statusBadge = (status: string) => {
        return (
            <Badge variant="outline" className={cn(
                'absolute top-2 right-2 text-xs z-20',
                status === 'APPROVED' && 'bg-green-100 text-green-800 border-transparent',
                status === 'PENDING' && 'bg-yellow-100 text-yellow-800 border-transparent',
                status === 'REJECTED' && 'bg-red-100 text-red-800 border-transparent'
            )}>
                {status}
            </Badge>
        );
    }
    
    return (
        <Card className="flex flex-col hover:shadow-lg transition-shadow duration-300 relative overflow-hidden group">
            {event.status && statusBadge(event.status)}
            <div className="relative aspect-[16/9] w-full">
              <Image 
                src={displayImage} 
                alt={event.name} 
                fill 
                className="rounded-t-lg object-cover" 
                data-ai-hint={event.hint ?? 'event'}
                onError={(e) => { 
                    const target = e.target as HTMLImageElement;
                    target.srcset = '';
                    target.src = DEFAULT_IMAGE_PLACEHOLDER;
                }}
              />
            </div>
            <CardContent className="p-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                    <Badge variant="outline" className={cn("text-xs", getCategoryBadgeClass(event.category))}>{event.category}</Badge>
                    <CardTitle className="text-lg leading-tight">{event.name}</CardTitle>
                    <div className="space-y-1 pt-1">
                      <CardDescription className="text-xs">{formatEventDate(event.startDate, event.endDate)}</CardDescription>
                      <CardDescription className="flex items-center gap-1.5 pt-1 text-xs">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                      </CardDescription>
                      {event.organizer?.firstName && (
                          <CardDescription className="flex items-center gap-1.5 pt-1 text-xs">
                              <User className="h-3 w-3" />
                              Creator: {event.organizer.firstName} {event.organizer.lastName}
                          </CardDescription>
                      )}
                      {event.status === 'REJECTED' && event.rejectionReason && (
                          <CardDescription className="text-xs text-red-600 pt-1 italic">
                              Reason: {event.rejectionReason}
                          </CardDescription>
                      )}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-2 border-t flex justify-end gap-1 bg-card rounded-b-lg">
                {hasPermission('Events:Update') && (
                    <Button asChild variant="ghost" size="icon">
                        <Link href={`/dashboard/events/${''}${event.id}/edit`} aria-label="Edit Event">
                            <Pencil className="h-4 w-4" />
                        </Link>
                    </Button>
                )}
                {hasPermission('Events:Delete') && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(event)}
                        aria-label="Delete Event"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
                {hasPermission('Events:Read') && (
                    <Button asChild size="icon" className="ml-auto">
                        <Link href={`/dashboard/events/${''}${event.id}`} aria-label="Manage Event">
                            <ArrowUpRight className="h-4 w-4" />
                        </Link>
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
};


const EventGrid = ({ events, isLoading, onDelete }: { events: EventWithOrganizer[], isLoading: boolean, onDelete: (e: EventWithOrganizer) => void }) => {
    if (isLoading) {
        return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                        <Skeleton className="w-full aspect-[16/9] rounded-t-lg" />
                        <CardContent className="p-4 space-y-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-7 w-3/4" />
                        <Skeleton className="h-5 w-1/2" />
                        </CardContent>
                        <CardFooter className="p-4">
                        <Skeleton className="h-9 w-full" />
                        </CardFooter>
                    </Card>
                ))}
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4 flex items-center justify-center p-8 text-center">
                <div>
                    <h3 className="text-2xl font-semibold tracking-tight">No events found in this category.</h3>
                </div>
            </Card>
        );
    }
    
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {events.map(event => (
                <EventCard
                    key={event.id}
                    event={event}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}

function ManageEventsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get('tab');

  const [loading, setLoading] = useState(true);
  const [eventToModify, setEventToModify] = useState<EventWithOrganizer | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const [allEvents, setAllEvents] = useState<EventWithOrganizer[]>([]);

  const [activeTab, setActiveTab] = useState(tabFromUrl || 'pending');
  
  useEffect(() => {
    if (tabFromUrl) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const fetchAllEvents = useCallback(async () => {
    setLoading(true);
    try {
        const allUserEvents = await getEvents('all');
        setAllEvents(allUserEvents);
    } catch (error) {
        console.error("Failed to fetch events:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to load events.' });
    } finally {
        setLoading(false);
    }
  }, [toast]);
  
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchedEvents = normalizedQuery
    ? allEvents.filter((event) => {
        const organizerName = event.organizer
          ? `${event.organizer.firstName ?? ''} ${event.organizer.lastName ?? ''}`.trim()
          : '';
        return (
          event.name.toLowerCase().includes(normalizedQuery) ||
          event.category.toLowerCase().includes(normalizedQuery) ||
          event.location.toLowerCase().includes(normalizedQuery) ||
          organizerName.toLowerCase().includes(normalizedQuery)
        );
      })
    : allEvents;

  const pendingEvents = searchedEvents.filter(e => e.status === 'PENDING');
  const approvedEvents = searchedEvents.filter(e => e.status === 'APPROVED');
  const rejectedEvents = searchedEvents.filter(e => e.status === 'REJECTED');

  const eventsForTab = (tab: string) => {
    switch (tab) {
      case 'pending': return pendingEvents;
      case 'approved': return approvedEvents;
      case 'rejected': return rejectedEvents;
      default: return searchedEvents;
    }
  };


  useEffect(() => {
    fetchAllEvents();
  }, [fetchAllEvents]);
  
  const handleOpenDeleteDialog = (event: EventWithOrganizer) => {
    setEventToModify(event);
    setIsAlertOpen(true);
  };

  const handleDelete = async () => {
    if (!eventToModify) return;
    setActionLoading(true);
    try {
        await deleteEvent(eventToModify.id);
        toast({
            title: 'Event Deleted',
            description: `"${eventToModify.name}" has been successfully deleted.`,
        });
        fetchAllEvents();
    } catch (error) {
        console.error("Failed to delete event:", error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to delete the event.',
        });
    } finally {
        setIsAlertOpen(false);
        setEventToModify(null);
        setActionLoading(false);
    }
  };

  const handleExport = () => {
    const eventsToExport = eventsForTab(activeTab);
    if (eventsToExport.length === 0) {
      toast({ variant: 'destructive', title: 'Nothing to Export', description: 'There are no events in the current view.' });
      return;
    }
    setIsExporting(true);
    try {
      const csvContent = convertEventsToCSV(eventsToExport);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `events_${activeTab}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export events:', error);
      toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not generate the export file.' });
    } finally {
      setIsExporting(false);
    }
  };

  const onTabChange = (value: string) => {
    setActiveTab(value);
    // Update URL to reflect the current tab
    router.replace(`/dashboard/events?tab=${''}${value}`, { scroll: false });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Events</h1>
          <p className="text-muted-foreground">View, edit, and manage your events.</p>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button variant="outline" onClick={handleExport} disabled={isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Export
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <TabsList>
            <TabsTrigger value="pending">Pending ({pendingEvents.length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({approvedEvents.length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({rejectedEvents.length})</TabsTrigger>
            <TabsTrigger value="all">All Events ({searchedEvents.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
            <EventGrid events={pendingEvents} isLoading={loading} onDelete={handleOpenDeleteDialog} />
        </TabsContent>
        <TabsContent value="approved" className="mt-4">
            <EventGrid events={approvedEvents} isLoading={loading} onDelete={handleOpenDeleteDialog} />
        </TabsContent>
        <TabsContent value="rejected" className="mt-4">
            <EventGrid events={rejectedEvents} isLoading={loading} onDelete={handleOpenDeleteDialog} />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
            <EventGrid events={searchedEvents} isLoading={loading} onDelete={handleOpenDeleteDialog} />
        </TabsContent>
      </Tabs>

       <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event
              <strong className="mx-1">"{eventToModify?.name}"</strong>
              and all of its associated data, including tickets and attendees.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ManageEventsPageContent;
