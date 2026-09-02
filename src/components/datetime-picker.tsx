
'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from './ui/input';

interface DateTimePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
}

type Period = 'AM' | 'PM';

function to12Hour(hours24: number): { hour12: number; period: Period } {
  const period: Period = hours24 >= 12 ? 'PM' : 'AM';
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return { hour12, period };
}

function to24Hour(hour12: number, period: Period): number {
  const base = hour12 % 12; // 12 -> 0
  return period === 'PM' ? base + 12 : base;
}

export function DateTimePicker({ date, setDate }: DateTimePickerProps) {
  const initial = to12Hour(date ? date.getHours() : 0);

  const [time, setTime] = React.useState({
    hour12: initial.hour12,
    minutes: date ? date.getMinutes() : 0,
    period: initial.period,
  });

  const applyTime = (newTime: typeof time, baseDate: Date | undefined) => {
    setTime(newTime);
    if (baseDate) {
      const newDate = new Date(baseDate);
      newDate.setHours(to24Hour(newTime.hour12, newTime.period), newTime.minutes);
      setDate(newDate);
    }
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      setDate(undefined);
      return;
    }
    applyTime(time, selectedDate);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = parseInt(e.target.value, 10);
    if (Number.isNaN(value)) value = 12;
    value = Math.min(12, Math.max(1, value));
    applyTime({ ...time, hour12: value }, date);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = parseInt(e.target.value, 10);
    if (Number.isNaN(value)) value = 0;
    value = Math.min(59, Math.max(0, value));
    applyTime({ ...time, minutes: value }, date);
  };

  const handlePeriodChange = (period: Period) => {
    applyTime({ ...time, period }, date);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={'outline'}
          className={cn(
            'w-full justify-start text-left font-normal',
            !date && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'PPP, hh:mm a') : <span>Pick a date and time</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          initialFocus
        />
        <div className="p-3 border-t border-border">
          <p className="text-sm font-medium text-center mb-2">Time</p>
          <div className="flex items-center justify-center gap-2">
            <Input
              type="number"
              name="hours"
              value={String(time.hour12).padStart(2, '0')}
              onChange={handleHourChange}
              className="w-16"
              max={12}
              min={1}
            />
            :
            <Input
              type="number"
              name="minutes"
              value={String(time.minutes).padStart(2, '0')}
              onChange={handleMinuteChange}
              className="w-16"
              max={59}
              min={0}
            />
            <div className="flex gap-1 ml-1">
              <Button
                type="button"
                size="sm"
                variant={time.period === 'AM' ? 'default' : 'outline'}
                className="h-9 px-2 text-xs"
                onClick={() => handlePeriodChange('AM')}
              >
                AM
              </Button>
              <Button
                type="button"
                size="sm"
                variant={time.period === 'PM' ? 'default' : 'outline'}
                className="h-9 px-2 text-xs"
                onClick={() => handlePeriodChange('PM')}
              >
                PM
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
