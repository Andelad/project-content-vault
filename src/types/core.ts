/**
 * Core application types - single source of truth
 * 
 * @see {@link /docs/core/App Logic.md} - Entity definitions
 * @see {@link /docs/core/Business Logic.md} - Business rules and validation
 */

export type ProjectStatus = 'current' | 'future' | 'archived';

/**
 * Recurring pattern configuration for phases.
 * Defines how a phase repeats over time (daily, weekly, monthly patterns).
 * 
 * @see {@link /docs/core/App Logic.md#4-phase} - Recurring phase definition
 */
export interface RecurringConfig {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number; // Every X days/weeks/months
  
  // Weekly recurrence options
  weeklyDayOfWeek?: number; // 0-6 (Sunday=0, Monday=1, ..., Saturday=6)
  
  // Monthly recurrence options
  monthlyPattern?: 'date' | 'dayOfWeek'; // Repeat by specific date or day of week
  monthlyDate?: number; // 1-31 for specific date of month
  monthlyWeekOfMonth?: number; // 1-4 for which week of the month
  monthlyDayOfWeek?: number; // 0-6 for day of week in monthly pattern
}

/**
 * Phase (time period within a project).
 * 
 * Represents a time-bounded allocation of work within a project.
 * Can be explicit (fixed dates) or recurring (pattern-based).
 * 
 * NOTE: Currently named "Milestone" in database and much of the codebase.
 * Migration to "Phase" terminology is in progress.
 * 
 * @see {@link /docs/core/App Logic.md#4-phase} - Phase entity definition
 * @see {@link /docs/core/Business Logic.md} - Phase business rules
 * @see {@link /docs/operations/MILESTONE_TO_PHASE_MIGRATION.md} - Migration plan
 */
export interface Milestone {
  id: string;
  name: string;
  projectId: string; // Maps to project_id in database
  
  // PRIMARY FIELDS (forecasting/estimation)
  endDate: Date; // Phase deadline
  timeAllocationHours: number; // Hours allocated for day estimates
  startDate?: Date; // When phase allocation begins (optional)
  
  // BACKWARD COMPATIBILITY (legacy code may still read these)
  /** @deprecated Use endDate instead. Will be removed in v2.0 */
  dueDate: Date;
  /** @deprecated Use timeAllocationHours instead. Will be removed in v2.0 */
  timeAllocation: number;
  
  // RECURRING PATTERNS (virtual instance generation)
  isRecurring?: boolean; // Whether this follows a recurring pattern
  recurringConfig?: RecurringConfig; // Pattern configuration if recurring
  
  // METADATA
  userId: string; // Maps to user_id in database
  createdAt: Date; // Converted from created_at string in repository layer
  updatedAt: Date; // Converted from updated_at string in repository layer
}

/**
 * Phase type alias - preferred terminology.
 * Use this in new code instead of Milestone.
 * 
 * @see {@link /docs/core/App Logic.md#4-phase} - Phase entity definition
 */
export type Phase = Milestone;

/**
 * Project entity - a piece of work with time estimate and deadline.
 * 
 * Projects can be:
 * - Time-limited: has end date, auto-estimates distributed across working days
 * - Continuous: no end date (ongoing work), progress tracking only
 * 
 * @see {@link /docs/core/App Logic.md#3-project} - Project entity definition
 * @see {@link /docs/core/Business Logic.md} - Project business rules
 */
export interface Project {
  id: string;
  name: string;
  
  // DEPRECATED FIELDS - Do not use in new code
  /** @deprecated Use clientId instead. Will be removed in v2.0 */
  client: string;
  /** @deprecated Row entity removed from data model. Will be removed in v2.0 */
  rowId?: string;
  
  // REQUIRED FIELDS
  clientId: string; // Foreign key to Client entity (required)
  startDate: Date;
  
  // CONDITIONAL: Required for time-limited, NULL for continuous
  // TODO: Should be Date | null to properly support continuous projects
  endDate: Date; // Required in DB but should be ignored when continuous=true
  
  estimatedHours: number; // >= 0, can be 0 for "no estimate"
  color: string;
  groupId: string; // REQUIRED: Projects must belong to a group
  notes?: string;
  icon?: string; // Lucide icon name, defaults to 'folder'
  
  // PROJECT TYPE
  continuous?: boolean; // When true, endDate is meaningless and should be ignored
  status?: ProjectStatus; // 'current' | 'future' | 'archived'
  
  // PHASES (time periods within project)
  milestones?: Milestone[]; // TODO: Rename to phases after migration
  
  // WORKING DAY OVERRIDES
  // TODO: Document in App Logic.md or remove if unused
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
  
  // Populated by joins
  clientData?: Client; // Populated when querying with client data
  labels?: Label[]; // Populated when querying with labels
}

/**
 * @deprecated Row entity has been removed from the data model.
 * Projects now belong directly to Groups.
 * This interface will be removed in v2.0.
 * 
 * @see {@link /docs/core/App Logic.md} - Row entity not present in current model
 */
export interface Row {
  id: string;
  groupId: string;
  name: string; // e.g., "Row 1", "Row 2"
  order: number; // For sorting rows within groups
}

/**
 * Group entity - primary way to organize projects by life area.
 * 
 * Examples: "Work", "Personal", "Health & Fitness"
 * 
 * @see {@link /docs/core/App Logic.md#5-group} - Group entity definition
 */
export interface Group {
  id: string;
  name: string; // Unique per user (case-insensitive)
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  // Note: color and description fields removed from database in Phase 5B
}

export type ClientStatus = 'active' | 'inactive' | 'archived';

/**
 * Client entity - organization or person work is done for.
 * 
 * @see {@link /docs/core/App Logic.md#2-client} - Client entity definition
 * @see {@link /docs/core/Business Logic.md} - Client validation rules
 */
export interface Client {
  id: string;
  name: string; // Required, unique per user (case-insensitive), 1-100 chars
  status: ClientStatus;
  contactEmail?: string; // Optional, basic format validation (@, ., no whitespace)
  contactPhone?: string; // Optional, can contain digits, spaces, hyphens, parentheses, plus
  billingAddress?: string; // Optional, free-form text
  notes?: string; // Optional, free-form text
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Label entity - flexible tags for categorizing projects.
 * 
 * Examples: "#urgent", "#q1-2026", "#pro-bono"
 * 
 * @see {@link /docs/core/App Logic.md#6-label} - Label entity definition
 */
export interface Label {
  id: string;
  name: string; // Required, unique per user (case-insensitive)
  color?: string; // Optional, for visual distinction
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Calendar Event - specific time block for work (planned or completed).
 * 
 * Events are defined by HOURS (specific times), not days.
 * Events linked to a project count toward that project's time.
 * Habits and tasks NEVER count toward project time.
 * 
 * @see {@link /docs/core/App Logic.md#7-calendar-event} - Event entity definition
 */
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
  category?: 'event' | 'habit' | 'task'; // Event category: 'event' (default), 'habit' (separate layer, no project), or 'task' (no duration, checkbox display)
  rrule?: string; // RFC 5545 RRULE string for recurring events (NEW SYSTEM)
  recurring?: { // LEGACY: Use rrule instead for new recurring events
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
  recurringGroupId?: string; // Group ID for linking recurring event instances
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
  isCompactView?: boolean; // Compact planner view (half vertical spacing)
}

export interface WorkHour {
  id: string;
  title: string;
  description?: string;
  startTime: Date; // Date object for consistency with how it's used in the app
  endTime: Date; // Date object for consistency with how it's used in the app  
  duration: number; // Duration in hours
  type?: 'work' | 'meeting' | 'break'; // Optional type for different work hour categories
  dayOfWeek?: string; // Day pattern (monday, tuesday, etc.) for recurring work hours
  slotId?: string; // Reference to WorkSlot ID in settings for recurring work hours
  isException?: boolean; // True if this work hour is an exception to the pattern
  rrule?: string; // RRULE string for infinite recurrence (e.g., "FREQ=WEEKLY;BYDAY=MO")
}

export interface WorkHourException {
  id: string;
  userId: string;
  exceptionDate: Date;
  dayOfWeek: string; // monday, tuesday, etc.
  slotId: string; // WorkSlot ID from settings.weekly_work_hours
  exceptionType: 'deleted' | 'modified';
  modifiedStartTime?: string; // HH:MM format if modified
  modifiedEndTime?: string; // HH:MM format if modified
  createdAt: Date;
  updatedAt: Date;
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

export type ViewType = 'timeline' | 'calendar' | 'projects' | 'reports' | 'settings' | 'profile' | 'insights' | 'feedback';

export interface DragState {
  projectId?: string;
  holidayId?: string;
  // Projects: only resize actions (start/end dates)
  // Holidays: resize actions + 'move' (can drag entire holiday)
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
  // 
  // NOTE: In the DOMAIN, events and estimates can coexist on the same day.
  // The "mutual exclusivity" is a TIMELINE VIEW constraint (bars can't overlap).
  // Other views (Planner, Reports) may display both simultaneously.
  // @see docs/core/View Specifications.md - Timeline View mutual exclusivity
  source: 'event' | 'milestone-allocation' | 'project-auto-estimate';
  milestoneId?: string;
  isWorkingDay: boolean;
  // Additional fields to track event type when source is 'event'
  isPlannedEvent?: boolean; // true if event is planned (not completed)
  isCompletedEvent?: boolean; // true if event is completed/tracked
}

// Individual work hour override for specific dates
export interface WorkHourOverride {
  date: string; // ISO date string (YYYY-MM-DD)
  dayName: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  slotIndex: number; // Index in the day's slots array
  startTime: string;
  endTime: string;
  duration: number;
}