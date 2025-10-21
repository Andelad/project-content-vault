// Core application types - single source of truth

export type ProjectStatus = 'current' | 'future' | 'archived';

// Recurring configuration for milestone patterns
export interface RecurringConfig {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  weeklyDayOfWeek?: number; // 0-6
  monthlyPattern?: 'date' | 'dayOfWeek';
  monthlyDate?: number; // 1-31
  monthlyWeekOfMonth?: number; // 1-4
  monthlyDayOfWeek?: number; // 0-6
}

export interface Milestone {
  id: string;
  name: string;
  projectId: string; // Maps to project_id in database
  
  // PRIMARY FIELDS (forecasting/estimation)
  endDate: Date; // Milestone deadline
  timeAllocationHours: number; // Hours allocated for day estimates
  startDate?: Date; // When milestone allocation begins (optional)
  
  // BACKWARD COMPATIBILITY (legacy code may still read these)
  dueDate: Date; // Use endDate instead
  timeAllocation: number; // Use timeAllocationHours instead
  
  // RECURRING PATTERNS (virtual instance generation)
  isRecurring?: boolean; // Whether this follows a recurring pattern
  recurringConfig?: RecurringConfig; // Pattern configuration if recurring
  
  // METADATA
  userId: string; // Maps to user_id in database
  createdAt: Date; // Converted from created_at string in repository layer
  updatedAt: Date; // Converted from updated_at string in repository layer
}

export interface Project {
  id: string;
  name: string;
  clientId?: string; // CHANGED: Now optional (was required) - like Toggl
  startDate: Date;
  endDate: Date;
  estimatedHours: number;
  color: string;
  groupId?: string; // CHANGED: Now optional (was required)
  rowId?: string; // CHANGED: Now optional (will be removed later)
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
  userId: string;
  createdAt: Date;
  updatedAt: Date;
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
  color?: string; // Optional: kept for backward compatibility
  description?: string; // Optional: kept for backward compatibility
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  billingAddress?: string;
  notes?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Label {
  id: string;
  name: string;
  color?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
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

export interface TimeEntry {
  id: string;
  projectId?: string;
  projectName: string; // Denormalized for reporting efficiency
  startTime: Date;
  endTime: Date;
  duration: number; // Duration in hours
  description?: string;
  isPaused?: boolean;
  totalPausedDuration?: number; // Paused time in milliseconds
  eventId?: string; // Link to associated calendar event
  createdAt: Date;
  updatedAt: Date;
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

// Day-level time estimate for timeline rendering
export interface DayEstimate {
  date: Date;
  projectId: string;
  hours: number;
  // CRITICAL: source indicates origin of time display
  // - 'event': Calendar event time (could be planned or completed)
  // - 'milestone-allocation': Calculated estimate from milestone
  // - 'project-auto-estimate': Calculated estimate from project budget
  // Events and estimates are mutually exclusive on any day
  source: 'event' | 'milestone-allocation' | 'project-auto-estimate';
  milestoneId?: string;
  isWorkingDay: boolean;
  // Additional fields to track event type when source is 'event'
  isPlannedEvent?: boolean; // true if event is planned (not completed)
  isCompletedEvent?: boolean; // true if event is completed/tracked
}