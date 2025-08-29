import React from 'react';
import moment from 'moment';
import { HoverablePlannerDateCell } from './HoverablePlannerDateCell';

interface CustomWeekHeaderProps {
  date: Date;
  label: string;
}

export function CustomWeekHeader({ date, label }: CustomWeekHeaderProps) {
  const today = new Date();
  const isToday = moment(date).isSame(today, 'day');
  
  return (
    <HoverablePlannerDateCell 
      date={date}
      className="h-full flex items-center justify-center"
    >
      <div className={`text-sm font-medium px-2 py-1 ${
        isToday 
          ? 'text-blue-600 bg-blue-50 rounded' 
          : 'text-gray-700'
      }`}>
        {label}
      </div>
    </HoverablePlannerDateCell>
  );
}

interface CustomDayHeaderProps {
  date: Date;
  label: string;
}

export function CustomDayHeader({ date, label }: CustomDayHeaderProps) {
  const today = new Date();
  const isToday = moment(date).isSame(today, 'day');
  
  return (
    <HoverablePlannerDateCell 
      date={date}
      className="h-full flex items-center justify-center"
    >
      <div className={`text-lg font-medium px-3 py-2 ${
        isToday 
          ? 'text-blue-600 bg-blue-50 rounded' 
          : 'text-gray-700'
      }`}>
        {label}
      </div>
    </HoverablePlannerDateCell>
  );
}
