
'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/date-range-picker';
import type { DateRange } from 'react-day-picker';
import type { District, Branch } from '@prisma/client';

interface EventOption {
  id: number;
  name: string;
}

interface SuperAdminFilterBarProps {
  districts: District[];
  branches: (Branch & { district: District })[];
  events: EventOption[];
  districtId: string | undefined;
  setDistrictId: (id: string | undefined) => void;
  branchId: string | undefined;
  setBranchId: (id: string | undefined) => void;
  eventId: number | undefined;
  setEventId: (id: number | undefined) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
}

export function SuperAdminFilterBar({
  districts,
  branches,
  events,
  districtId,
  setDistrictId,
  branchId,
  setBranchId,
  eventId,
  setEventId,
  dateRange,
  setDateRange,
}: SuperAdminFilterBarProps) {
  const filteredBranches = districtId ? branches.filter((b) => b.districtId === districtId) : branches;

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2">
      <Select
        value={districtId ?? 'all'}
        onValueChange={(v) => {
          setDistrictId(v === 'all' ? undefined : v);
          setBranchId(undefined);
        }}
      >
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="All Regions/Districts" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Regions/Districts</SelectItem>
          {districts.map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={branchId ?? 'all'}
        onValueChange={(v) => setBranchId(v === 'all' ? undefined : v)}
      >
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="All Branches" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Branches</SelectItem>
          {filteredBranches.map((b) => (
            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={eventId !== undefined ? String(eventId) : 'all'}
        onValueChange={(v) => setEventId(v === 'all' ? undefined : Number(v))}
      >
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="All Events" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Events</SelectItem>
          {events.map((e) => (
            <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DateRangePicker date={dateRange} setDate={setDateRange} />
    </div>
  );
}
