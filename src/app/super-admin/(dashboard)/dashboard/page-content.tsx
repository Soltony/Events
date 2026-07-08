
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Ticket as TicketIcon, Calendar as CalendarIcon, Users, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { DateRange } from 'react-day-picker';
import type { District, Branch } from '@prisma/client';
import {
  getSuperAdminFilters,
  getPerformanceOverview,
  type PerformanceFilters,
} from '@/lib/super-admin-actions';
import { SuperAdminFilterBar } from '@/components/super-admin-filter-bar';

interface Overview {
  totalEvents: number;
  pendingEvents: number;
  approvedEvents: number;
  totalRevenue: number;
  totalTicketsSold: number;
  totalAttendees: number;
  checkedInAttendees: number;
  checkInRate: number;
}

export default function DashboardPageContent() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [branches, setBranches] = useState<(Branch & { district: District })[]>([]);
  const [events, setEvents] = useState<{ id: number; name: string }[]>([]);
  const [districtId, setDistrictId] = useState<string | undefined>();
  const [branchId, setBranchId] = useState<string | undefined>();
  const [eventId, setEventId] = useState<number | undefined>();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSuperAdminFilters().then(({ districts, branches, events }) => {
      setDistricts(districts);
      setBranches(branches as (Branch & { district: District })[]);
      setEvents(events);
    });
  }, []);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    const filters: PerformanceFilters = {
      districtId,
      branchId,
      eventId,
      from: dateRange?.from?.toISOString(),
      to: dateRange?.to?.toISOString(),
    };
    const data = await getPerformanceOverview(filters);
    setOverview(data);
    setLoading(false);
  }, [districtId, branchId, eventId, dateRange]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-8">
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Performance Overview</h1>
          <p className="text-muted-foreground">Organization-wide KPIs across all branches and districts.</p>
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

      {loading || !overview ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">ETB {overview.totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">From approved events</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tickets Sold</CardTitle>
              <TicketIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.totalTicketsSold.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.totalEvents.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{overview.pendingEvents} pending approval</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Attendees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.totalAttendees.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Checked In</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.checkedInAttendees.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{(overview.checkInRate * 100).toFixed(1)}% check-in rate</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
