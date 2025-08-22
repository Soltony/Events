

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, DollarSign, FileDown, Ticket as TicketIcon, ArrowLeft, Loader2, MapPin, Info, Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { getEventDetails, addTicketType, addPromoCode, updateTicketType, deleteTicketType, updatePromoCode, deletePromoCode, updateEventStatus } from '@/lib/actions';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { cn } from "@/lib/utils";
import { Skeleton } from '@/components/ui/skeleton';
import type { Event, TicketType, Attendee, PromoCode } from '@prisma/client';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/context/auth-context';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface EventDetails extends Event {
    ticketTypes: TicketType[];
    attendees: (Attendee & { ticketType: TicketType })[];
    promoCodes: PromoCode[];
}

const addTicketTypeSchema = z.object({
  name: z.string().min(1, { message: "Ticket name is required." }),
  price: z.coerce.number().min(0, { message: 'Price must be a positive number.' }),
  total: z.coerce.number().int().min(1, { message: 'Quantity must be at least 1.' }),
});

type AddTicketTypeFormValues = z.infer<typeof addTicketTypeSchema>;

const addPromoCodeSchema = z.object({
  code: z.string().min(3, { message: "Promo code must be at least 3 characters." }).max(20, { message: "Promo code cannot exceed 20 characters."}),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.coerce.number().min(0, { message: "Value must be a positive number." }),
  maxUses: z.coerce.number().int().min(1, { message: "Usage limit must be at least 1." }),
});

type AddPromoCodeFormValues = z.infer<typeof addPromoCodeSchema>;

// Helper to convert array of objects to CSV
function convertToCSV(data: any[], headers: { key: string, label: string }[]): string {
    const headerRow = headers.map(h => h.label).join(',');
    const bodyRows = data.map(row => {
        return headers.map(header => {
            let value = row[header.key];
            
            if (header.key.includes('.')) {
                const keys = header.key.split('.');
                let nestedValue: any = row;
                for (const k of keys) {
                    if (nestedValue && typeof nestedValue === 'object') {
                        nestedValue = nestedValue[k];
                    } else {
                        nestedValue = undefined;
                        break;
                    }
                }
                value = nestedValue;
            }

            const stringValue = String(value ?? '').replace(/"/g, '""');
            return `"${stringValue}"`;
        }).join(',');
    });
    return [headerRow, ...bodyRows].join('\n');
}


export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = params.id ? parseInt(params.id, 10) : -1;
  const { user } = useAuth();
  const isAdmin = user?.role?.name === 'Admin';
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddTicketTypeOpen, setIsAddTicketTypeOpen] = useState(false);
  const [isAddPromoCodeOpen, setIsAddPromoCodeOpen] = useState(false);
  const [isEditTicketTypeOpen, setIsEditTicketTypeOpen] = useState(false);
  const [isEditPromoCodeOpen, setIsEditPromoCodeOpen] = useState(false);
  const [ticketToEdit, setTicketToEdit] = useState<TicketType | null>(null);
  const [promoToEdit, setPromoToEdit] = useState<PromoCode | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: number; name: string; type: 'ticket' | 'promo' } | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const fetchEvent = async () => {
    try {
      setLoading(true);
      const foundEvent = await getEventDetails(eventId);
      setEvent(foundEvent);
    } catch (e) {
      console.error("Failed to fetch event details", e);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId !== -1) {
      fetchEvent();
    } else {
        setLoading(false);
    }
  }, [eventId]);

  const ticketForm = useForm<AddTicketTypeFormValues>({
    resolver: zodResolver(addTicketTypeSchema),
    defaultValues: {
      name: '',
      price: 0,
      total: 100,
    },
  });
  
  const promoCodeForm = useForm<AddPromoCodeFormValues>({
    resolver: zodResolver(addPromoCodeSchema),
    defaultValues: {
      code: '',
      type: 'PERCENTAGE',
      value: 10,
      maxUses: 100,
    },
  });

  useEffect(() => {
    if (ticketToEdit) {
      ticketForm.reset({
        name: ticketToEdit.name,
        price: Number(ticketToEdit.price),
        total: ticketToEdit.total,
      });
    }
  }, [ticketToEdit, ticketForm]);

  useEffect(() => {
    if (promoToEdit) {
      promoCodeForm.reset({
        code: promoToEdit.code,
        type: promoToEdit.type,
        value: Number(promoToEdit.value),
        maxUses: promoToEdit.maxUses,
      });
    }
  }, [promoToEdit, promoCodeForm]);


  const onAddTicketTypeSubmit = async (data: AddTicketTypeFormValues) => {
    try {
      await addTicketType(eventId, data);
      toast({
        title: 'Ticket Type Added',
        description: `Successfully added the "${data.name}" ticket type.`,
      });
      await fetchEvent();
      setIsAddTicketTypeOpen(false);
      ticketForm.reset();
    } catch (error) {
      console.error("Failed to add ticket type:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add ticket type. Please try again.' });
    }
  };

  const onEditTicketTypeSubmit = async (data: AddTicketTypeFormValues) => {
    if (!ticketToEdit) return;
    try {
      await updateTicketType(ticketToEdit.id, data);
      toast({ title: 'Ticket Type Updated' });
      await fetchEvent();
      setIsEditTicketTypeOpen(false);
      setTicketToEdit(null);
    } catch (error) {
      console.error("Failed to update ticket type:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update ticket type.' });
    }
  };
  
  const onAddPromoCodeSubmit = async (data: AddPromoCodeFormValues) => {
    try {
      await addPromoCode(eventId, data);
       toast({
        title: 'Promo Code Created',
        description: `Successfully created the "${data.code}" promo code.`,
      });
      await fetchEvent();
      setIsAddPromoCodeOpen(false);
      promoCodeForm.reset();
    } catch (error) {
       console.error("Failed to add promo code:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to create promo code. Please try again.' });
    }
  }

  const onEditPromoCodeSubmit = async (data: AddPromoCodeFormValues) => {
    if (!promoToEdit) return;
    try {
      await updatePromoCode(promoToEdit.id, data);
      toast({ title: 'Promo Code Updated' });
      await fetchEvent();
      setIsEditPromoCodeOpen(false);
      setPromoToEdit(null);
    } catch (error) {
      console.error("Failed to update promo code:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update promo code.' });
    }
  };

  const handleOpenDeleteDialog = (item: { id: number; name: string; type: 'ticket' | 'promo' }) => {
    setItemToDelete(item);
    setIsAlertOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.type === 'ticket') {
        await deleteTicketType(itemToDelete.id);
        toast({ title: 'Ticket Type Deleted' });
      } else if (itemToDelete.type === 'promo') {
        await deletePromoCode(itemToDelete.id);
        toast({ title: 'Promo Code Deleted' });
      }
      await fetchEvent();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to delete item.' });
    } finally {
      setIsAlertOpen(false);
      setItemToDelete(null);
    }
  }


  const handleExport = () => {
    if (!event) return;
    setIsExporting(true);

    try {
      const headers = [
        { key: 'name', label: 'Name' },
        { key: 'phoneNumber', label: 'Phone Number' },
        { key: 'ticketType.name', label: 'Ticket Type' },
        { key: 'checkedIn', label: 'Checked In' },
        { key: 'createdAt', label: 'Purchase Date' },
      ];
      
      const dataToExport = event.attendees.map(a => ({
          ...a,
          createdAt: format(new Date(a.createdAt), 'yyyy-MM-dd HH:mm'),
      }))

      const csvContent = convertToCSV(dataToExport, headers);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${event.name.replace(/\s+/g, '_')}_attendee_report.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: 'Export Successful', description: 'Your attendee report has been downloaded.' });

    } catch(error) {
        console.error('Failed to export report', error);
        toast({ variant: 'destructive', title: 'Export Failed', description: 'Could not generate the report.' });
    } finally {
        setTimeout(() => setIsExporting(false), 1000);
    }
  }

  const handleApprove = async () => {
    if (!event) return;
    setActionLoading(true);
    try {
      await updateEventStatus(event.id, 'APPROVED');
      toast({ title: 'Event Approved', description: `"${event.name}" is now live.`});
      await fetchEvent(); // Refreshes the current page
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to approve event.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!event) return;
    setActionLoading(true);
    try {
      await updateEventStatus(event.id, 'REJECTED', rejectionReason);
      toast({ title: 'Event Rejected' });
      await fetchEvent(); // Refreshes the current page
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Failed to reject event.' });
    } finally {
      setActionLoading(false);
      setIsRejectDialogOpen(false);
      setRejectionReason('');
    }
  }


  if (loading) {
    return (
        <div className="flex flex-1 flex-col gap-4 md:gap-8 p-4 lg:p-6">
            <div className="flex items-center justify-between">
                <div>
                    <Skeleton className="h-8 w-64 mb-2" />
                    <Skeleton className="h-5 w-48" />
                </div>
                <Skeleton className="h-10 w-32" />
            </div>
            <Skeleton className="h-10 w-full" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card><CardHeader className="space-y-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-6 w-32" /></CardHeader><CardContent><Skeleton className="h-4 w-20" /></CardContent></Card>
                <Card><CardHeader className="space-y-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-6 w-32" /></CardHeader><CardContent><Skeleton className="h-4 w-20" /></CardContent></Card>
                <Card><CardHeader className="space-y-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-4 w-12" /></CardHeader><CardContent><Skeleton className="h-4 w-full" /></CardContent></Card>
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-7 w-48 mb-2" />
                    <Skeleton className="h-4 w-80" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="min-h-[300px] w-full" />
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!event) {
    return (
        <div className="flex items-center justify-center h-full">
            <Card>
                <CardHeader>
                    <CardTitle>Event Not Found</CardTitle>
                    <CardDescription>The event you are looking for does not exist.</CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
  }
  
  const chartData = event.ticketTypes.map(item => ({
    name: item.name,
    sold: item.sold,
    remaining: item.total - item.sold,
  }));

  const chartConfig = {
    sold: {
      label: "Sold",
      color: "hsl(var(--primary))",
    },
    remaining: {
      label: "Remaining",
      color: "hsl(var(--secondary))",
    },
  };

  const totalSold = event.ticketTypes.reduce((sum, t) => sum + t.sold, 0);
  const totalCapacity = event.ticketTypes.reduce((sum, t) => sum + t.total, 0);
  const totalRevenue = event.ticketTypes.reduce((sum, t) => sum + (t.sold * Number(t.price)), 0);
  const selloutPercentage = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0;
  
  const eventDate = event.endDate 
    ? `${format(new Date(event.startDate), 'LLL dd, y, hh:mm a')} - ${format(new Date(event.endDate), 'LLL dd, y, hh:mm a')}`
    : format(new Date(event.startDate), 'LLL dd, y, hh:mm a');

  return (
    <>
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                    <span className="sr-only">Back</span>
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{event.name}</h1>
                    <div className="text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:gap-4 flex-wrap">
                        <span className="text-sm">{eventDate}</span>
                        <span className="flex items-center gap-1 text-sm"><MapPin className="h-4 w-4" /> {event.location}</span>
                        {event.hint && <span className="flex items-center gap-1 text-sm"><Info className="h-4 w-4" /> {event.hint}</span>}
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                 {isAdmin && event.status === 'PENDING' && (
                  <div className="flex gap-2">
                      <Button variant="outline" onClick={handleApprove} disabled={actionLoading}>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Approve
                      </Button>
                       <Button variant="destructive" onClick={() => setIsRejectDialogOpen(true)} disabled={actionLoading}>
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                      </Button>
                  </div>
                 )}
                <Button onClick={handleExport} disabled={isExporting}>
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                    Export Report
                </Button>
            </div>
        </div>

      <Tabs defaultValue="dashboard">
        <div className="overflow-x-auto">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 sm:w-auto">
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="attendees">Attendees</TabsTrigger>
                <TabsTrigger value="tickets">Tickets</TabsTrigger>
                <TabsTrigger value="promo">Promo Codes</TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">ETB {totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">from {totalSold.toLocaleString()} tickets sold</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tickets Sold</CardTitle>
                <TicketIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalSold.toLocaleString()} / {totalCapacity.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{totalCapacity - totalSold} tickets remaining</p>
              </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Capacity</CardTitle>
                    <p className="text-sm font-medium">{selloutPercentage.toFixed(0)}%</p>
                </CardHeader>
                <CardContent>
                    <Progress value={selloutPercentage} aria-label={`${selloutPercentage.toFixed(0)}% sold out`} />
                </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Ticket Sales by Type</CardTitle>
              <CardDescription>A breakdown of tickets sold vs. remaining for each type.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                <BarChart accessibilityLayer data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                  <YAxis />
                  <Tooltip cursor={{fill: 'hsl(var(--muted))'}} content={<ChartTooltipContent />} />
                  <Bar dataKey="sold" stackId="a" fill="var(--color-sold)" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="remaining" stackId="a" fill="var(--color-remaining)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendees">
            <Card>
                <CardHeader>
                    <CardTitle>Attendees</CardTitle>
                    <CardDescription>Manage attendee check-ins. {event.attendees.length} people have tickets.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">Check-in</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Ticket Type</TableHead>
                                    <TableHead>Phone Number</TableHead>
                                    <TableHead className="text-right">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {event.attendees.map((attendee) => (
                                    <TableRow key={attendee.id}>
                                        <TableCell>
                                            <Checkbox checked={attendee.checkedIn} aria-label={`Check in ${attendee.name}`} />
                                        </TableCell>
                                        <TableCell className="font-medium">{attendee.name}</TableCell>
                                        <TableCell>
                                            <Badge variant={attendee.ticketType.name === 'VIP Pass' ? 'default' : 'secondary'}>{attendee.ticketType.name}</Badge>
                                        </TableCell>
                                        <TableCell>{attendee.phoneNumber}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="outline" className={cn(attendee.checkedIn ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-transparent' : '')}>
                                                {attendee.checkedIn ? 'Checked In' : 'Awaiting'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="tickets">
            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <CardTitle>Ticket Tiers</CardTitle>
                        <CardDescription>Manage ticket types and quantities for your event.</CardDescription>
                    </div>
                    <Dialog open={isAddTicketTypeOpen} onOpenChange={setIsAddTicketTypeOpen}>
                      <DialogTrigger asChild>
                        <Button><PlusCircle className="mr-2 h-4 w-4" /> Add Ticket Type</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Ticket Type</DialogTitle>
                          <DialogDescription>Fill out the details for the new ticket tier.</DialogDescription>
                        </DialogHeader>
                        <Form {...ticketForm}>
                          <form onSubmit={ticketForm.handleSubmit(onAddTicketTypeSubmit)} className="space-y-4">
                             <FormField control={ticketForm.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel>Ticket Name</FormLabel><FormControl><Input placeholder="e.g. General Admission" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <div className="grid grid-cols-2 gap-4">
                               <FormField control={ticketForm.control} name="price" render={({ field }) => (
                                  <FormItem><FormLabel>Price (ETB)</FormLabel><FormControl><Input type="number" placeholder="500" {...field} /></FormControl><FormMessage /></FormItem>
                               )}/>
                               <FormField control={ticketForm.control} name="total" render={({ field }) => (
                                  <FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" placeholder="100" {...field} /></FormControl><FormMessage /></FormItem>
                               )}/>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsAddTicketTypeOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={ticketForm.formState.isSubmitting}>
                                    {ticketForm.formState.isSubmitting && <Loader2 className="animate-spin mr-2" />} Add Ticket
                                </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead>Sold / Total</TableHead>
                                    <TableHead>Revenue</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {event.ticketTypes.map((ticket) => (
                                    <TableRow key={ticket.id}>
                                        <TableCell className="font-medium">{ticket.name}</TableCell>
                                        <TableCell>ETB {Number(ticket.price).toFixed(2)}</TableCell>
                                        <TableCell>{ticket.sold} / {ticket.total}</TableCell>
                                        <TableCell>ETB {(ticket.sold * Number(ticket.price)).toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => { setTicketToEdit(ticket); setIsEditTicketTypeOpen(true); }}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog({ id: ticket.id, name: ticket.name, type: 'ticket' })}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="promo">
            <Card>
                 <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <CardTitle>Promotional Codes</CardTitle>
                        <CardDescription>Create and manage discount codes to boost sales.</CardDescription>
                    </div>
                    <Dialog open={isAddPromoCodeOpen} onOpenChange={setIsAddPromoCodeOpen}>
                        <DialogTrigger asChild>
                            <Button><PlusCircle className="mr-2 h-4 w-4" /> Create Code</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New Promo Code</DialogTitle>
                                <DialogDescription>Configure a new discount code for your event.</DialogDescription>
                            </DialogHeader>
                            <Form {...promoCodeForm}>
                                <form onSubmit={promoCodeForm.handleSubmit(onAddPromoCodeSubmit)} className="space-y-4">
                                    <FormField control={promoCodeForm.control} name="code" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Code</FormLabel>
                                            <FormControl><Input placeholder="e.g., EARLYBIRD25" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <FormField control={promoCodeForm.control} name="type" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Discount Type</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select a discount type" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                                                    <SelectItem value="FIXED">Fixed Amount</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={promoCodeForm.control} name="value" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Value</FormLabel>
                                                <FormControl><Input type="number" placeholder={promoCodeForm.getValues('type') === 'PERCENTAGE' ? '25' : '100'} {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}/>
                                        <FormField control={promoCodeForm.control} name="maxUses" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Usage Limit</FormLabel>
                                                <FormControl><Input type="number" placeholder="100" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}/>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setIsAddPromoCodeOpen(false)}>Cancel</Button>
                                        <Button type="submit" disabled={promoCodeForm.formState.isSubmitting}>
                                            {promoCodeForm.formState.isSubmitting && <Loader2 className="animate-spin mr-2" />} Create Code
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Value</TableHead>
                                    <TableHead>Usage</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {event.promoCodes.map((code) => (
                                    <TableRow key={code.id}>
                                        <TableCell className="font-mono">{code.code}</TableCell>
                                        <TableCell className="capitalize">{code.type.toLowerCase()}</TableCell>
                                        <TableCell>
                                            {code.type === 'PERCENTAGE' ? `${code.value}% off` : `ETB ${Number(code.value).toFixed(2)} off`}
                                        </TableCell>
                                        <TableCell>{code.uses} / {code.maxUses}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => { setPromoToEdit(code); setIsEditPromoCodeOpen(true); }}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog({ id: code.id, name: code.code, type: 'promo' })}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
    
    {/* Edit Ticket Type Dialog */}
    <Dialog open={isEditTicketTypeOpen} onOpenChange={setIsEditTicketTypeOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Ticket Type</DialogTitle>
          <DialogDescription>Update the details for the "{ticketToEdit?.name}" ticket.</DialogDescription>
        </DialogHeader>
        <Form {...ticketForm}>
          <form onSubmit={ticketForm.handleSubmit(onEditTicketTypeSubmit)} className="space-y-4">
             <FormField control={ticketForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Ticket Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )}/>
            <div className="grid grid-cols-2 gap-4">
               <FormField control={ticketForm.control} name="price" render={({ field }) => (
                  <FormItem><FormLabel>Price (ETB)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
               )}/>
               <FormField control={ticketForm.control} name="total" render={({ field }) => (
                  <FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
               )}/>
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditTicketTypeOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={ticketForm.formState.isSubmitting}>
                    {ticketForm.formState.isSubmitting && <Loader2 className="animate-spin mr-2" />} Save Changes
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* Edit Promo Code Dialog */}
    <Dialog open={isEditPromoCodeOpen} onOpenChange={setIsEditPromoCodeOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Promo Code</DialogTitle>
                <DialogDescription>Update the details for the "{promoToEdit?.code}" promo code.</DialogDescription>
            </DialogHeader>
            <Form {...promoCodeForm}>
                <form onSubmit={promoCodeForm.handleSubmit(onEditPromoCodeSubmit)} className="space-y-4">
                    <FormField control={promoCodeForm.control} name="code" render={({ field }) => (
                        <FormItem><FormLabel>Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={promoCodeForm.control} name="type" render={({ field }) => (
                        <FormItem><FormLabel>Discount Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                                    <SelectItem value="FIXED">Fixed Amount</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={promoCodeForm.control} name="value" render={({ field }) => (
                            <FormItem><FormLabel>Value</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={promoCodeForm.control} name="maxUses" render={({ field }) => (
                            <FormItem><FormLabel>Usage Limit</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsEditPromoCodeOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={promoCodeForm.formState.isSubmitting}>
                            {promoCodeForm.formState.isSubmitting && <Loader2 className="animate-spin mr-2" />} Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the <strong>{itemToDelete?.name}</strong> {itemToDelete?.type}.
                 {itemToDelete?.type === 'ticket' && ' This may affect users who have already purchased this ticket type.'}
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                Delete
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
     <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reject Event: {event?.name}</DialogTitle>
                <DialogDescription>Please provide a reason for rejecting this event. This will be visible to the organizer.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="rejection-reason" className="text-right">Reason</Label>
                    <Textarea 
                        id="rejection-reason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="col-span-3"
                        placeholder="e.g., Missing required information, event not suitable for platform."
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
                    {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Rejection
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

