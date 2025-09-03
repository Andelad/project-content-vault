// Core application types - single source of truth

export type ProjectStatus = 'current' | 'future' | 'archived';

export interface Milestone {
  id: string;
  name: string;
  dueDate: Date;
  timeAllocation: number; // Allocated hours for this milestone
  projectId: string;
  order: number; // For sorting milestones within a project
}

export interface Project {
  id: string;
  name: string;
  client: string;
  startDate: Date;
  endDate: Date;
  estimatedHours: number;
  color: string;
  groupId: string;
  rowId: string; // Projects now belong to rows
  notes?: string;
  icon?: string; // Lucide icon name, defaults to 'folder'
  milestones?: Milestone[]; // Project milestones
  continuous?: boolean; // Whether the project is continuous (no end date)
  status?: ProjectStatus; // Project status for organization
  autoEstimateDays?: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  }; // Days to include in auto-estimation (default: all true)
}

export interface Row {
  id: string;
  groupId: string;
  name: string; // e.g., "Row 1", "Row 2"
  order: number; // For sorting rows within groups
}

export interface Group {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  projectId?: string;
  color: string;
  completed?: boolean; // Whether the event has been marked as completed
  description?: string; // Optional description
  duration?: number; // Duration in hours
  type?: 'planned' | 'tracked' | 'completed'; // Type to distinguish between planned, tracked, and completed events
  recurring?: {
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number; // Every X days/weeks/months/years
    endDate?: Date; // When to stop recurring
    count?: number; // Or number of occurrences
    // Enhanced monthly pattern options
    monthlyPattern?: 'date' | 'dayOfWeek'; // Pattern type for monthly recurrence
    monthlyDate?: number; // 1-31 for specific date of month
    monthlyWeekOfMonth?: number; // 1-5 for which week of the month (1st, 2nd, 3rd, 4th, last)
    monthlyDayOfWeek?: number; // 0-6 for day of week in monthly pattern
  };
  // Properties for handling midnight-crossing events
  originalEventId?: string; // Reference to original event if this is a split
  isSplitEvent?: boolean; // Whether this event is part of a split midnight-crossing event
}

export interface Holiday {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  notes?: string;
}

export interface WorkSlot {
  id: string;
  startTime: string; // Time in HH:MM format (e.g., "09:00")
  endTime: string;   // Time in HH:MM format (e.g., "17:00") 
  duration: number;  // Duration in hours (calculated, supports 15min increments)
}

export interface Settings {
  weeklyWorkHours: {
    monday: WorkSlot[];
    tuesday: WorkSlot[];
    wednesday: WorkSlot[];
    thursday: WorkSlot[];
    friday: WorkSlot[];
    saturday: WorkSlot[];
    sunday: WorkSlot[];
  };
  defaultView?: string;
}

export interface WorkHour {
  id: string;
  title: string;
  description?: string;
  startTime: Date; // Date object for consistency with how it's used in the app
  endTime: Date; // Date object for consistency with how it's used in the app  
  duration: number; // Duration in hours
  type?: 'work' | 'meeting' | 'break'; // Optional type for different work hour categories
}

export interface TimelineEntry {
  date: Date;
  projectId: string;
  hours: number;
}

export type ViewType = 'timeline' | 'calendar' | 'projects' | 'reports' | 'settings' | 'profile';

export interface DragState {
  projectId?: string;
  holidayId?: string;
  action: 'move' | 'resize-start-date' | 'resize-end-date' | 'resize-left' | 'resize-right';
  startX: number;
  startY: number;
  originalStartDate: Date;
  originalEndDate: Date;
  lastDaysDelta: number;
}

export interface AutoScrollState {
  isScrolling: boolean;
  direction: 'left' | 'right' | null;
  intervalId: NodeJS.Timeout | null;
}