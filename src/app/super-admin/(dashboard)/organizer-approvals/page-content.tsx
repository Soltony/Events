
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User, Branch, District, UserStatus } from '@prisma/client';
import { format } from 'date-fns';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Eye, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  getOrganizerRegistrations,
  approveOrganizer,
  rejectOrganizer,
} from '@/lib/organizer-approval-actions';

interface OrganizerRegistration extends User {
  branch?: (Branch & { district: District }) | null;
}

function statusBadgeClass(status: UserStatus) {
  return cn(
    status === 'ACTIVE' && 'border-green-500 text-green-700',
    status === 'PENDING' && 'border-yellow-500 text-yellow-700',
    status === 'REJECTED' && 'border-red-500 text-red-700'
  );
}

export default function OrganizerApprovalsPageContent({ basePath = '/super-admin' }: { basePath?: string }) {
  const { toast } = useToast();
  const router = useRouter();

  const [organizers, setOrganizers] = useState<OrganizerRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [organizerToView, setOrganizerToView] = useState<OrganizerRegistration | null>(null);
  const [organizerToReject, setOrganizerToReject] = useState<OrganizerRegistration | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrganizerRegistrations('all');
      setOrganizers(data);
    } catch (error) {
      console.error('Failed to fetch organizer registrations:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load organizer registrations.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pending = organizers.filter((o) => o.status === 'PENDING');
  const approved = organizers.filter((o) => o.status === 'ACTIVE');
  const rejected = organizers.filter((o) => o.status === 'REJECTED');

  const listForTab = (tab: string) => {
    switch (tab) {
      case 'PENDING':
        return pending;
      case 'ACTIVE':
        return approved;
      case 'REJECTED':
        return rejected;
      default:
        return organizers;
    }
  };

  const handleApprove = async (organizer: OrganizerRegistration) => {
    setActionLoading(organizer.id);
    try {
      await approveOrganizer(organizer.id);
      toast({ title: 'Organizer Approved', description: `${organizer.firstName} ${organizer.lastName} can now access the system.` });
      await fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to approve organizer.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!organizerToReject) return;
    setActionLoading(organizerToReject.id);
    try {
      await rejectOrganizer(organizerToReject.id, rejectionReason);
      toast({ title: 'Organizer Rejected' });
      await fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error?.message || 'Failed to reject organizer.' });
    } finally {
      setActionLoading(null);
      setOrganizerToReject(null);
      setRejectionReason('');
    }
  };

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 md:gap-8">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Event Organizer Approvals</h1>
            <p className="text-muted-foreground">Review, approve, or reject new Event Organizer registrations.</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="PENDING">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="ACTIVE">Approved ({approved.length})</TabsTrigger>
            <TabsTrigger value="REJECTED">Rejected ({rejected.length})</TabsTrigger>
            <TabsTrigger value="all">All ({organizers.length})</TabsTrigger>
          </TabsList>

          {['PENDING', 'ACTIVE', 'REJECTED', 'all'].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              {loading ? (
                <Card>
                  <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
                  <CardContent><Skeleton className="h-40 w-full" /></CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Organizer Registrations</CardTitle>
                    <CardDescription>Users registered with the Organizer role.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone Number</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Branch / District</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {listForTab(tab).map((organizer) => (
                          <TableRow key={organizer.id}>
                            <TableCell className="font-medium">{organizer.firstName} {organizer.lastName}</TableCell>
                            <TableCell>{organizer.phoneNumber}</TableCell>
                            <TableCell>{organizer.email || <span className="text-muted-foreground">-</span>}</TableCell>
                            <TableCell>
                              {organizer.branch ? (
                                <div>
                                  <p className="font-medium">{organizer.branch.name}</p>
                                  <p className="text-xs text-muted-foreground">{organizer.branch.district.name}</p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{format(new Date(organizer.createdAt), 'LLL dd, y')}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusBadgeClass(organizer.status)}>
                                {organizer.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setOrganizerToView(organizer)} aria-label="View details">
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {organizer.status !== 'ACTIVE' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleApprove(organizer)}
                                    disabled={actionLoading === organizer.id}
                                  >
                                    {actionLoading === organizer.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    )}
                                    <span className="ml-2">Approve</span>
                                  </Button>
                                )}
                                {organizer.status !== 'REJECTED' && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setOrganizerToReject(organizer)}
                                    disabled={actionLoading === organizer.id}
                                  >
                                    <XCircle className="h-4 w-4" />
                                    <span className="ml-2">Reject</span>
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {listForTab(tab).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center h-24">No organizer registrations found.</TableCell>
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

      <Dialog open={!!organizerToView} onOpenChange={(open) => !open && setOrganizerToView(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{organizerToView?.firstName} {organizerToView?.lastName}</DialogTitle>
            <DialogDescription>Event Organizer registration details.</DialogDescription>
          </DialogHeader>
          {organizerToView && (
            <div className="grid gap-3 py-2 text-sm">
              <div className="grid grid-cols-3 gap-2"><span className="text-muted-foreground">Phone</span><span className="col-span-2">{organizerToView.phoneNumber}</span></div>
              <div className="grid grid-cols-3 gap-2"><span className="text-muted-foreground">Email</span><span className="col-span-2">{organizerToView.email || '-'}</span></div>
              <div className="grid grid-cols-3 gap-2"><span className="text-muted-foreground">NIB Account</span><span className="col-span-2">{organizerToView.nibBankAccount || '-'}</span></div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Branch</span>
                <span className="col-span-2">
                  {organizerToView.branch ? `${organizerToView.branch.name} (${organizerToView.branch.district.name})` : '-'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2"><span className="text-muted-foreground">Submitted</span><span className="col-span-2">{format(new Date(organizerToView.createdAt), 'PPP p')}</span></div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Status</span>
                <span className="col-span-2">
                  <Badge variant="outline" className={statusBadgeClass(organizerToView.status)}>{organizerToView.status}</Badge>
                </span>
              </div>
              {organizerToView.status === 'REJECTED' && (
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-muted-foreground">Reason</span>
                  <span className="col-span-2 italic">{organizerToView.rejectionReason || 'No reason provided.'}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!organizerToReject} onOpenChange={(open) => !open && setOrganizerToReject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Organizer: {organizerToReject?.firstName} {organizerToReject?.lastName}</DialogTitle>
            <DialogDescription>Optionally provide a reason for rejecting this registration. This will be visible to the organizer.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="organizer-rejection-reason" className="text-right">Reason</Label>
              <Textarea
                id="organizer-rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Incomplete information, ineligible business type."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOrganizerToReject(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!actionLoading}>
              {actionLoading === organizerToReject?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
