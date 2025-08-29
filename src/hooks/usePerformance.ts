import { useMemo } from 'react';

/**
 * Performance-related React hooks
 * These hooks provide memoized calculations for performance optimization
 */

/**
 * Memoized date string comparison to avoid repeated toString calls
 */
export const useDateComparison = (dates: Date[], projectDays: Date[]) => {
  return useMemo(() => {
    const projectDayStrings = new Set(projectDays.map(d => d.toDateString()));
    return dates.map(date => ({
      date,
      dateString: date.toDateString(),
      isProjectDay: projectDayStrings.has(date.toDateString())
    }));
  }, [dates, projectDays]);
};

/**
 * Memoized working day calculations
 */
export const useWorkingDayCalculator = (settings: any) => {
  return useMemo(() => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    return (date: Date) => {
      const dayName = dayNames[date.getDay()] as keyof typeof settings.weeklyWorkHours;
      return settings.weeklyWorkHours[dayName] > 0;
    };
  }, [settings.weeklyWorkHours]);
};
