
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { DateRange } from 'react-day-picker';
import type { District, Branch } from '@prisma/client';
import {
  getSuperAdminFilters,
  getDistrictPerformance,
  type PerformanceFilters,
} from '@/lib/super-admin-actions';
import { SuperAdminFilterBar } from '@/components/super-admin-filter-bar';

interface DistrictRow {
  id: string;
  name: string;
  eventsCount: number;
  ticketsSold: number;
  revenue: number;
}

export default function DistrictsPageContent() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [branches, setBranches] = useState<(Branch & { district: District })[]>([]);
  const [events, setEvents] = useState<{ id: number; name: string }[]>([]);
  const [districtId, setDistrictId] = useState<string | undefined>();
  const [branchId, setBranchId] = useState<string | undefined>();
  const [eventId, setEventId] = useState<number | undefined>();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [rows, setRows] = useState<DistrictRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSuperAdminFilters().then(({ districts, branches, events }) => {
      setDistricts(districts);
      setBranches(branches as (Branch & { district: District })[]);
      setEvents(events);
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const filters: PerformanceFilters = {
      districtId,
      branchId,
      eventId,
      from: dateRange?.from?.toISOString(),
      to: dateRange?.to?.toISOString(),
    };
    const data = await getDistrictPerformance(filters);
    setRows(data);
    setLoading(false);
  }, [districtId, branchId, eventId, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartConfig = {
    revenue: { label: 'Revenue (ETB)', color: '#FEB914' },
  };

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">District Comparison</h1>
          <p className="text-muted-foreground">Compare event volume, ticket sales, and revenue across districts (regions).</p>
        </div>
        <SuperAdminFilterBar
          districts={districts}
          branches={branches}
          events={events}
          districtId={districtId}
          setDistrictId={setDistrictId}
          branchId={branchId}
          setBranchId={setBranchId}
          eventId={eventId}
          setEventId={setEventId}
          dateRange={dateRange}
          setDateRange={setDateRange}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue by District</CardTitle>
          <CardDescription>Revenue from approved events, grouped by district.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart data={rows}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>District Performance Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>District</TableHead>
                <TableHead className="text-right">Events</TableHead>
                <TableHead className="text-right">Tickets Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right">{row.eventsCount}</TableCell>
                  <TableCell className="text-right">{row.ticketsSold.toLocaleString()}</TableCell>
                  <TableCell className="text-right">ETB {row.revenue.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">No district data available.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
