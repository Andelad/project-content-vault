import React, { useMemo } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type FilterByStatus = 'all' | 'active' | 'future' | 'past';

interface Holiday {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
}

interface HolidaysTabProps {
  holidays: Holiday[];
  holidayStatusFilter: FilterByStatus;
  onHolidayClick: (holiday: Holiday) => void;
}

export function HolidaysTab({
  holidays,
  holidayStatusFilter,
  onHolidayClick,
}: HolidaysTabProps) {
  const filteredHolidays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return holidays.filter(holiday => {
      const startDate = new Date(holiday.startDate);
      const endDate = new Date(holiday.endDate);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      if (holidayStatusFilter === 'all') return true;
      if (holidayStatusFilter === 'active') {
        return today >= startDate && today <= endDate;
      }
      if (holidayStatusFilter === 'future') {
        return startDate > today;
      }
      if (holidayStatusFilter === 'past') {
        return endDate < today;
      }
      return true;
    });
  }, [holidays, holidayStatusFilter]);

  if (filteredHolidays.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="text-gray-400 mb-4">
            <Calendar className="w-16 h-16" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No holidays found
          </h3>
          <p className="text-gray-600 text-center mb-6 max-w-md">
            {holidayStatusFilter !== 'all'
              ? 'Try adjusting your filter to see more holidays'
              : 'Add your first holiday to get started.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {filteredHolidays.map((holiday) => {
        const startDate = new Date(holiday.startDate);
        const endDate = new Date(holiday.endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let statusBadge = null;
        let statusVariant: "default" | "secondary" | "outline" = "secondary";

        if (today >= startDate && today <= endDate) {
          statusBadge = 'Active';
          statusVariant = "default";
        } else if (startDate > today) {
          statusBadge = 'Future';
          statusVariant = "outline";
        } else {
          statusBadge = 'Past';
          statusVariant = "secondary";
        }

        const durationMs = endDate.getTime() - startDate.getTime();
        const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24)) + 1;

        return (
          <Card
            key={holiday.id}
            onClick={() => onHolidayClick(holiday)}
            className="hover:shadow-lg transition-shadow cursor-pointer"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                {/* Left section - Holiday info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate text-sm">
                        {holiday.title}
                      </h3>
                      <Badge variant={statusVariant} className="flex-shrink-0 text-xs">
                        {statusBadge}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Middle section - Date range */}
                <div className="flex items-center gap-4 flex-1 justify-center">
                  <div className="text-xs text-gray-600">
                    <span className="whitespace-nowrap">
                      {startDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="mx-2 text-gray-400">→</span>
                    <span className="whitespace-nowrap">
                      {endDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {/* Right section - Duration */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Clock className="w-3 h-3" />
                    <span>
                      {durationDays} {durationDays === 1 ? 'day' : 'days'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
