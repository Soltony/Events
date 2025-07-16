
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { PlusCircle, DollarSign, FileDown, Ticket as TicketIcon, ArrowLeft } from 'lucide-react';
import { getEventDetails } from '@/lib/actions';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { cn } from "@/lib/utils";
import { Skeleton } from '@/components/ui/skeleton';
import RecommendationTool from '@/components/recommendation-tool';
import type { Event, TicketType, Attendee, PromoCode } from '@prisma/client';
import { format } from 'date-fns';

interface EventDetails extends Event {
    ticketTypes: TicketType[];
    attendees: (Attendee & { ticketType: TicketType })[];
    promoCodes: PromoCode[];
}

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = params.id ? parseInt(params.id, 10) : -1;
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId !== -1) {
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
      fetchEvent();
    } else {
        setLoading(false);
    }
  }, [eventId]);

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
    ? `${format(new Date(event.startDate), 'LLL dd, y')} - ${format(new Date(event.endDate), 'LLL dd, y')}`
    : format(new Date(event.startDate), 'LLL dd, y');

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
        <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
            <p className="text-muted-foreground">{eventDate} at {event.location}</p>
        </div>
        <Button>
          <FileDown className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="attendees">Attendees</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="promo">Promo Codes</TabsTrigger>
        </TabsList>

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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">Check-in</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Ticket Type</TableHead>
                                <TableHead>Email</TableHead>
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
                                    <TableCell>{attendee.email}</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="outline" className={cn(attendee.checkedIn ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-transparent' : '')}>
                                            {attendee.checkedIn ? 'Checked In' : 'Awaiting'}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="tickets">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Ticket Tiers</CardTitle>
                        <CardDescription>Manage ticket types and quantities for your event.</CardDescription>
                    </div>
                    <Button><PlusCircle className="mr-2 h-4 w-4" /> Add Ticket Type</Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Sold / Total</TableHead>
                                <TableHead>Revenue</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {event.ticketTypes.map((ticket) => (
                                <TableRow key={ticket.id}>
                                    <TableCell className="font-medium">{ticket.name}</TableCell>
                                    <TableCell>ETB {Number(ticket.price).toFixed(2)}</TableCell>
                                    <TableCell>{ticket.sold} / {ticket.total}</TableCell>
                                    <TableCell>ETB {(ticket.sold * Number(ticket.price)).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="promo">
            <Card>
                 <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Promotional Codes</CardTitle>
                        <CardDescription>Create and manage discount codes to boost sales.</CardDescription>
                    </div>
                    <Button><PlusCircle className="mr-2 h-4 w-4" /> Create Code</Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Value</TableHead>
                                <TableHead>Usage</TableHead>
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
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
      <div className="mt-8">
        <RecommendationTool />
      </div>
    </div>
  );
}
