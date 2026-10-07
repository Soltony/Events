
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { Event as EventType, User as UserType } from '@prisma/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getEventsForApproval, updateEventStatus } from '@/lib/actions';

interface EventForApproval extends EventType {
  organizer?: Partial<UserType>;
}

function statusBadgeClass(status: string) {
  return cn(
    status === 'APPROVED' && 'border-green-500 text-green-700',
    status === 'PENDING' && 'border-yellow-500 text-yellow-700',
    status === 'REJECTED' && 'border-red-500 text-red-700'
  );
}

function formatEventDate(startDate: Date, endDate: Date | null | undefined): string {
  const dateFormat = 'LLL dd, y, hh:mm a';
  if (endDate) {
    return `${format(new Date(startDate), dateFormat)} - ${format(new Date(endDate), dateFormat)}`;
  }
  return format(new Date(startDate), dateFormat);
}

export default function EventApprovalsPageContent() {
  const { toast } = useToast();

  const [events, setEvents] = useState<EventForApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [eventToReject, setEventToReject] = useState<EventForApproval | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEventsForApproval('all');
      setEvents(data);
    } catch (error) {
      console.error('Failed to fetch events for approval:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load events awaiting approval.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pending = events.filter((e) => e.status === 'PENDING');
  const approved = events.filter((e) => e.status === 'APPROVED');
  const rejected = events.filter((e) => e.status === 'REJECTED');

  const listForTab = (tab: string) => {
    switch (tab) {
      case 'PENDING':
        return pending;
      case 'APPROVED':
        return approved;
      case 'REJECTED':
        return rejected;
      default:
        return events;
    }
  };

  const handleApprove = async (event: EventForApproval) => {
    setActionLoading(event.id);
    try {
      await updateEventStatus(event.id, 'APPROVED');
      toast({ title: 'Event Approved', description: `"${event.name}" is now live.` });
      await fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to approve event.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!eventToReject) return;
    setActionLoading(eventToReject.id);
    try {
      await updateEventStatus(eventToReject.id, 'REJECTED', rejectionReason);
      toast({ title: 'Event Rejected' });
      await fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to reject event.' });
    } finally {
      setActionLoading(null);
      setEventToReject(null);
      setRejectionReason('');
    }
  };

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 md:gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Event Approvals</h1>
          <p className="text-muted-foreground">Review, approve, or reject events submitted by organizers.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="PENDING">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="APPROVED">Approved ({approved.length})</TabsTrigger>
            <TabsTrigger value="REJECTED">Rejected ({rejected.length})</TabsTrigger>
            <TabsTrigger value="all">All Events ({events.length})</TabsTrigger>
          </TabsList>

          {['PENDING', 'APPROVED', 'REJECTED', 'all'].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              {loading ? (
                <Card>
                  <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                  <CardContent><Skeleton className="h-40 w-full" /></CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Events</CardTitle>
                    <CardDescription>Events submitted for review across all organizers.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead>Organizer</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {listForTab(tab).map((event) => (
                          <TableRow key={event.id}>
                            <TableCell className="font-medium">{event.name}</TableCell>
                            <TableCell>
                              {event.organizer?.firstName
                                ? `${event.organizer.firstName} ${event.organizer.lastName ?? ''}`
                                : <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>{event.category}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatEventDate(event.startDate, event.endDate)}</TableCell>
                            <TableCell>{event.location.replace(/\|\|/g, ', ')}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusBadgeClass(event.status)}>
                                {event.status}
                              </Badge>
                              {event.status === 'REJECTED' && event.rejectionReason && (
                                <p className="text-xs text-muted-foreground italic mt-1">{event.rejectionReason}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button asChild variant="ghost" size="icon" aria-label="View event details">
                                  <Link href={`/dashboard/events/${event.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>
                                {event.status === 'PENDING' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleApprove(event)}
                                      disabled={actionLoading === event.id}
                                    >
                                      {actionLoading === event.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      )}
                                      <span className="ml-2">Approve</span>
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => setEventToReject(event)}
                                      disabled={actionLoading === event.id}
                                    >
                                      <XCircle className="h-4 w-4" />
                                      <span className="ml-2">Reject</span>
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {listForTab(tab).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center h-24">No events found in this category.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <Dialog open={!!eventToReject} onOpenChange={(open) => !open && setEventToReject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Event: {eventToReject?.name}</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this event. This will be visible to the organizer.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="event-rejection-reason" className="text-right">Reason</Label>
              <Textarea
                id="event-rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Missing required information, event not suitable for platform."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEventToReject(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!actionLoading}>
              {actionLoading === eventToReject?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
