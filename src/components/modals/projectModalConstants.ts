// Project modal constants and utilities
import {
  Folder, Briefcase, Zap, Target, Lightbulb, Rocket, Star, Heart, Gift, Music, Camera, Code, Book, Gamepad2, Coffee, Home, Building, Car, Plane, Map, Globe, Infinity
} from 'lucide-react';

// Time formatting utility
export const formatTimeHoursMinutes = (hours: number): string => {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (wholeHours === 0 && minutes === 0) {
    return '0h';
  } else if (wholeHours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${wholeHours}h`;
  } else {
    return `${wholeHours}h ${minutes}m`;
  }
};

// Project colors using OKLCH color space for better accessibility
export const OKLCH_PROJECT_COLORS = [
  'oklch(0.65 0.15 25)',   // Warm red
  'oklch(0.65 0.15 45)',   // Orange
  'oklch(0.65 0.15 85)',   // Yellow
  'oklch(0.65 0.15 145)',  // Lime green
  'oklch(0.65 0.15 165)',  // Green
  'oklch(0.65 0.15 205)',  // Teal
  'oklch(0.65 0.15 245)',  // Blue
  'oklch(0.65 0.15 285)',  // Purple
  'oklch(0.65 0.15 325)',  // Pink
  'oklch(0.65 0.15 15)',   // Deep red
  'oklch(0.55 0.08 25)',   // Muted red
  'oklch(0.55 0.08 85)',   // Muted yellow
  'oklch(0.55 0.08 165)',  // Muted green
  'oklch(0.55 0.08 245)',  // Muted blue
  'oklch(0.55 0.08 325)',  // Muted pink
];

// Project icons mapping
export const PROJECT_ICONS = [
  { name: 'folder', label: 'Folder', component: Folder },
  { name: 'briefcase', label: 'Briefcase', component: Briefcase },
  { name: 'zap', label: 'Zap', component: Zap },
  { name: 'target', label: 'Target', component: Target },
  { name: 'lightbulb', label: 'Lightbulb', component: Lightbulb },
  { name: 'rocket', label: 'Rocket', component: Rocket },
  { name: 'star', label: 'Star', component: Star },
  { name: 'heart', label: 'Heart', component: Heart },
  { name: 'gift', label: 'Gift', component: Gift },
  { name: 'music', label: 'Music', component: Music },
  { name: 'camera', label: 'Camera', component: Camera },
  { name: 'code', label: 'Code', component: Code },
  { name: 'book', label: 'Book', component: Book },
  { name: 'gamepad2', label: 'Gamepad', component: Gamepad2 },
  { name: 'coffee', label: 'Coffee', component: Coffee },
  { name: 'home', label: 'Home', component: Home },
  { name: 'building', label: 'Building', component: Building },
  { name: 'car', label: 'Car', component: Car },
  { name: 'plane', label: 'Plane', component: Plane },
  { name: 'map', label: 'Map', component: Map },
  { name: 'globe', label: 'Globe', component: Globe },
  { name: 'infinity', label: 'Infinity', component: Infinity },
];

// Date formatting utilities
export const formatDate = (date: Date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
};

export const formatDateForInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Working days calculation utilities
export const calculateWorkingDaysRemaining = (endDate: Date, settings: any, holidays: any[]): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetEndDate = new Date(endDate);
  targetEndDate.setHours(0, 0, 0, 0);

  // If end date is in the past or today, return 0
  if (targetEndDate <= today) {
    return 0;
  }

  // If no settings, return 0
  if (!settings?.weeklyWorkHours) {
    return 0;
  }

  let workingDays = 0;
  const current = new Date(today);
  current.setDate(current.getDate() + 1); // Start from tomorrow

  while (current <= targetEndDate) {
    // Check if it's a holiday
    const isHoliday = holidays.some(holiday => {
      const holidayStart = new Date(holiday.startDate);
      const holidayEnd = new Date(holiday.endDate);
      holidayStart.setHours(0, 0, 0, 0);
      holidayEnd.setHours(0, 0, 0, 0);
      return current >= holidayStart && current <= holidayEnd;
    });

    if (!isHoliday) {
      // Check if it's a day with work hours configured
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[current.getDay()] as keyof typeof settings.weeklyWorkHours;
      const workSlots = settings.weeklyWorkHours?.[dayName] || [];

      const hasWorkHours = Array.isArray(workSlots) &&
        workSlots.reduce((sum, slot) => sum + slot.duration, 0) > 0;

      if (hasWorkHours) {
        workingDays++;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return workingDays;
};

export const calculateTotalWorkingDays = (startDate: Date, endDate: Date, settings: any, holidays: any[]): number => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  // If no settings, return 0
  if (!settings?.weeklyWorkHours) {
    return 0;
  }

  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    // Check if it's a holiday
    const isHoliday = holidays.some(holiday => {
      const holidayStart = new Date(holiday.startDate);
      const holidayEnd = new Date(holiday.endDate);
      holidayStart.setHours(0, 0, 0, 0);
      holidayEnd.setHours(0, 0, 0, 0);
      return current >= holidayStart && current <= holidayEnd;
    });

    if (!isHoliday) {
      // Check if it's a day with work hours configured
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[current.getDay()] as keyof typeof settings.weeklyWorkHours;
      const workSlots = settings.weeklyWorkHours?.[dayName] || [];

      const hasWorkHours = Array.isArray(workSlots) &&
        workSlots.reduce((sum, slot) => sum + slot.duration, 0) > 0;

      if (hasWorkHours) {
        workingDays++;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return workingDays;
};
