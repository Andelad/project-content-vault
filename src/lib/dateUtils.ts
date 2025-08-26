// Utility functions for date calculations to avoid repeated computations
import { HeightCalculationService } from '@/services/HeightCalculationService';

const dateCache = new Map<string, Date>();

export function getCachedDate(dateString: string): Date {
  if (!dateCache.has(dateString)) {
    dateCache.set(dateString, new Date(dateString));
  }
  return dateCache.get(dateString)!;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

export function calculateProjectMetrics(project: any) {
  const projectStart = new Date(project.startDate);
  const projectEnd = new Date(project.endDate);
  
  const totalDays = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const hoursPerDay = project.estimatedHours / totalDays;
  const roundedHoursPerDay = Math.ceil(hoursPerDay);
  const heightInPixels = HeightCalculationService.calculateProjectHeight(roundedHoursPerDay);
  
  return {
    dailyHours: roundedHoursPerDay,
    heightInPixels,
    totalDays
  };
}

export function getProjectDaysInViewport(project: any, viewportStart: Date, viewportEnd: Date): Date[] {
  const projectStart = new Date(project.startDate);
  const projectEnd = new Date(project.endDate);
  
  if (projectEnd < viewportStart || projectStart > viewportEnd) {
    return [];
  }
  
  const projectDays = [];
  const visibleStart = projectStart < viewportStart ? viewportStart : projectStart;
  const visibleEnd = projectEnd > viewportEnd ? viewportEnd : projectEnd;
  
  for (let d = new Date(visibleStart); d <= visibleEnd; d.setDate(d.getDate() + 1)) {
    projectDays.push(new Date(d));
  }
  
  return projectDays;
}

export function getDayDifference(date1: Date, date2: Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}