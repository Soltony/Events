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
import { PlusCircle, DollarSign, FileDown, Ticket as TicketIcon } from 'lucide-react';
import { events, ticketTypes, attendees, promoCodes } from '@/lib/mock-data';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { cn } from "@/lib/utils";

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const eventId = parseInt(params.id, 10);
  const event = events.find((e) => e.id === eventId);
  const eventTicketTypes = ticketTypes.filter((t) => t.eventId === eventId);
  const eventAttendees = attendees.filter((a) => a.eventId === eventId);
  const eventPromoCodes = promoCodes.filter((p) => p.eventId === eventId);

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
  
  const chartData = eventTicketTypes.map(item => ({
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

  const totalSold = eventTicketTypes.reduce((sum, t) => sum + t.sold, 0);
  const totalCapacity = eventTicketTypes.reduce((sum, t) => sum + t.total, 0);
  const totalRevenue = eventTicketTypes.reduce((sum, t) => sum + (t.sold * t.price), 0);
  const selloutPercentage = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0;

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">{event.name}</h1>
            <p className="text-muted-foreground">{event.date} at {event.location}</p>
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
                <div className="text-2xl font-bold">${totalRevenue.toLocaleString()}</div>
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
                    <CardDescription>Manage attendee check-ins. {eventAttendees.length} people have tickets.</CardDescription>
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
                            {eventAttendees.map((attendee) => (
                                <TableRow key={attendee.id}>
                                    <TableCell>
                                        <Checkbox checked={attendee.checkedIn} aria-label={`Check in ${attendee.name}`} />
                                    </TableCell>
                                    <TableCell className="font-medium">{attendee.name}</TableCell>
                                    <TableCell>
                                        <Badge variant={attendee.ticketType === 'VIP' ? 'default' : 'secondary'}>{attendee.ticketType}</Badge>
                                    </TableCell>
                                    <TableCell>{attendee.email}</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="outline" className={cn(attendee.checkedIn ? 'bg-accent text-accent-foreground border-transparent' : '')}>
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
                            {eventTicketTypes.map((ticket) => (
                                <TableRow key={ticket.id}>
                                    <TableCell className="font-medium">{ticket.name}</TableCell>
                                    <TableCell>${ticket.price.toFixed(2)}</TableCell>
                                    <TableCell>{ticket.sold} / {ticket.total}</TableCell>
                                    <TableCell>${(ticket.sold * ticket.price).toLocaleString()}</TableCell>
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
                            {eventPromoCodes.map((code) => (
                                <TableRow key={code.id}>
                                    <TableCell className="font-mono">{code.code}</TableCell>
                                    <TableCell className="capitalize">{code.type}</TableCell>
                                    <TableCell>
                                        {code.type === 'percentage' ? `${code.value}% off` : `$${code.value.toFixed(2)} off`}
                                    </TableCell>
                                    <TableCell>{code.uses} / {code.maxUses} uses</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
