import React from 'react';
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Project } from "@/types";

interface AutoEstimateDaysSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  localValues: {
    name: string;
    client: string;
    estimatedHours: number;
    notes: string;
    startDate: Date;
    endDate: Date;
    color: string;
    icon: string;
    continuous: boolean;
    autoEstimateDays?: {
      monday: boolean;
      tuesday: boolean;
      wednesday: boolean;
      thursday: boolean;
      friday: boolean;
      saturday: boolean;
      sunday: boolean;
    };
  };
  setLocalValues: (updater: (prev: any) => any) => void;
  onAutoEstimateDaysChange?: (newAutoEstimateDays: any) => void;
}

const DAYS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
] as const;

export function AutoEstimateDaysSection({
  isExpanded,
  onToggle,
  localValues,
  setLocalValues,
  onAutoEstimateDaysChange,
}: AutoEstimateDaysSectionProps) {
  // Initialize autoEstimateDays with all days enabled if not set
  const autoEstimateDays = localValues.autoEstimateDays || {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: true,
    sunday: true,
  };

  const handleDayToggle = (day: keyof typeof autoEstimateDays) => {
    const newAutoEstimateDays = {
      ...autoEstimateDays,
      [day]: !autoEstimateDays[day],
    };
    
    setLocalValues(prev => ({
      ...prev,
      autoEstimateDays: newAutoEstimateDays,
    }));
    
    // Call the change handler if provided (for immediate persistence)
    if (onAutoEstimateDaysChange) {
      onAutoEstimateDaysChange(newAutoEstimateDays);
    }
  };

  const enabledDaysCount = Object.values(autoEstimateDays).filter(Boolean).length;

  return (
    <div className="px-8 py-6 space-y-4">
      <div className="text-sm text-muted-foreground">
        Select which days of the week to include when auto-estimating project time. 
        Unchecked days will be excluded from receiving auto-estimated time, similar to weekends or holidays.
      </div>
      
      <div className="grid grid-cols-7 gap-4">
        {DAYS.map(({ key, label }) => (
          <div key={key} className="flex flex-col items-center space-y-2">
            <span className="text-sm font-medium text-gray-700">
              {label}
            </span>
            <Checkbox
              id={`auto-estimate-${key}`}
              checked={autoEstimateDays[key]}
              onCheckedChange={() => handleDayToggle(key)}
            />
          </div>
        ))}
      </div>

      {enabledDaysCount === 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
          <p className="text-sm text-orange-700">
            ⚠️ Warning: No days are selected. Auto-estimation will not work properly.
          </p>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {enabledDaysCount} day{enabledDaysCount !== 1 ? 's' : ''} enabled for auto-estimation
      </div>
    </div>
  );
}
