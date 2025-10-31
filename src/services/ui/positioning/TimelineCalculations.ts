/**
 * Timeline Calculation Functions
 * Migrated from legacy TimelineCalculationService
 * Pure calculation functions for timeline positioning and sizing
 */
import { formatDateShort, formatWeekdayDate } from '@/utils/dateFormatUtils';
import { isToday, isTodayInWeek, isWeekendDate } from '../../calculations/general/dateCalculations';

export interface TimelinePosition {
  left: number;
  width: number;
  top?: number;
  height?: number;
}

export interface ViewportConfig {
  startDate: Date;
  endDate: Date;
  columnWidth: number;
  totalWidth: number;
  mode: 'days' | 'weeks';
}

// ============================================================================
// UTILITY FUNCTIONS (Used by other functions)
// ============================================================================

/**
 * Calculate offset between two dates based on timeline mode
 * Migrated from TimelineCalculationService.getDateOffset (private method)
 */
export function getDateOffset(
  targetDate: Date,
  baseDate: Date,
  mode: 'days' | 'weeks'
): number {
  try {
    if (!targetDate || !baseDate) {
      console.error('getDateOffset: Invalid date parameters', { targetDate, baseDate });
      return 0;
    }
    
    const timeDiff = targetDate.getTime() - baseDate.getTime();
    const daysDiff = Math.floor(timeDiff / (24 * 60 * 60 * 1000));

    if (mode === 'weeks') {
      return Math.floor(daysDiff / 7);
    }

    return daysDiff;
  } catch (error) {
    console.error('Error in getDateOffset:', error);
    return 0;
  }
}

/**
 * Add offset to a date based on timeline mode
 * Migrated from TimelineCalculationService.addDateOffset (private method)
 */
export function addDateOffset(
  baseDate: Date,
  offset: number,
  mode: 'days' | 'weeks'
): Date {
  const result = new Date(baseDate);

  if (mode === 'weeks') {
    result.setDate(result.getDate() + offset * 7);
  } else {
    result.setDate(result.getDate() + offset);
  }

  return result;
}

/**
 * Format date label for timeline columns
 * Migrated from TimelineCalculationService.formatDateLabel (private method)
 */
export function formatDateLabel(date: Date, mode: 'days' | 'weeks'): string {
  if (mode === 'weeks') {
    return formatDateShort(date);
  } else {
    return formatWeekdayDate(date);
  }
}

// ============================================================================
// MAIN CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate position for a project bar in the timeline
 * Migrated from TimelineCalculationService.calculateProjectPosition
 */
export function calculateProjectPosition(
  projectStart: Date,
  projectEnd: Date,
  viewport: ViewportConfig
): TimelinePosition {
  try {
    if (!projectStart || !projectEnd || !viewport) {
      console.error('calculateProjectPosition: Invalid parameters', { projectStart, projectEnd, viewport });
      return { left: 0, width: 0 };
    }

    const { startDate, columnWidth, mode } = viewport;

    // Calculate left position
    const startOffset = getDateOffset(projectStart, startDate, mode);
    const left = Math.max(0, startOffset * columnWidth);

    // Calculate width
    const duration = getDateOffset(projectEnd, projectStart, mode) + 1;
    const width = Math.max(columnWidth * 0.8, duration * columnWidth);

    return { left, width };
  } catch (error) {
    console.error('Error in calculateProjectPosition:', error);
    return { left: 0, width: 0 };
  }
}

/**
 * Calculate position for a milestone diamond
 * Migrated from TimelineCalculationService.calculateMilestonePosition
 */
export function calculateMilestonePosition(
  milestoneDate: Date,
  projectStart: Date,
  projectPosition: TimelinePosition,
  viewport: ViewportConfig
): TimelinePosition {
  const { mode, columnWidth } = viewport;

  // Calculate offset from project start
  const offsetFromProjectStart = getDateOffset(milestoneDate, projectStart, mode);

  // Determine actual day spacing based on mode
  const daySpacing = mode === 'weeks' ? 22 : columnWidth; // 22px effective spacing in weeks (21px + 1px gap), 52px in days
  const relativeLeft = offsetFromProjectStart * daySpacing;

  // Position milestone at END of its day column (add day spacing)
  const left = projectPosition.left + relativeLeft + daySpacing;
  const width = 16; // Diamond size
  const height = 16;

  return { left, width, height };
}

/**
 * Calculate row height based on project workload
 * Migrated from TimelineCalculationService.calculateRowHeight
 */
export function calculateRowHeight(dailyHours: number, baseHeight: number = 40): number {
  // Scale height based on daily workload
  const heightScale = Math.max(1, dailyHours / 8); // 8 hours = normal day
  return Math.min(baseHeight * heightScale, baseHeight * 3); // Cap at 3x base height
}

/**
 * Calculate timeline scroll position to center on date
 * Migrated from TimelineCalculationService.calculateScrollToDate
 */
export function calculateScrollToDate(
  targetDate: Date,
  viewport: ViewportConfig,
  containerWidth: number
): number {
  const { startDate, columnWidth, mode } = viewport;
  const offset = getDateOffset(targetDate, startDate, mode);
  const targetPosition = offset * columnWidth;

  // Center the date in the viewport
  return Math.max(0, targetPosition - containerWidth / 2);
}

/**
 * Calculate visible date range for the current viewport
 * Migrated from TimelineCalculationService.calculateVisibleDateRange
 */
export function calculateVisibleDateRange(
  scrollLeft: number,
  containerWidth: number,
  viewport: ViewportConfig
): { start: Date; end: Date } {
  const { startDate, columnWidth, mode } = viewport;

  const startOffset = Math.floor(scrollLeft / columnWidth);
  const endOffset = Math.ceil((scrollLeft + containerWidth) / columnWidth);

  const start = addDateOffset(startDate, startOffset, mode);
  const end = addDateOffset(startDate, endOffset, mode);

  return { start, end };
}

/**
 * Calculate column positions for timeline grid
 * Migrated from TimelineCalculationService.calculateColumnPositions
 */
export function calculateColumnPositions(
  viewport: ViewportConfig,
  visibleColumns: number
): Array<{ date: Date; position: number; label: string }> {
  const { startDate, columnWidth, mode } = viewport;
  const columns: Array<{ date: Date; position: number; label: string }> = [];

  for (let i = 0; i < visibleColumns; i++) {
    const date = addDateOffset(startDate, i, mode);
    const position = i * columnWidth;
    const label = formatDateLabel(date, mode);

    columns.push({ date, position, label });
  }

  return columns;
}

/**
 * Calculate drag constraints for a project
 * Migrated from TimelineCalculationService.calculateDragConstraints
 */
export function calculateDragConstraints(
  project: { startDate: Date; endDate: Date },
  viewport: ViewportConfig,
  containerBounds: { left: number; right: number }
): { minLeft: number; maxLeft: number } {
  const projectDuration = getDateOffset(project.endDate, project.startDate, viewport.mode);
  const projectWidth = projectDuration * viewport.columnWidth;

  return {
    minLeft: containerBounds.left,
    maxLeft: containerBounds.right - projectWidth
  };
}

/**
 * Convert pixel position to date
 * Migrated from TimelineCalculationService.pixelToDate
 */
export function pixelToDate(
  pixelPosition: number,
  viewport: ViewportConfig
): Date {
  const { startDate, columnWidth, mode } = viewport;

  if (mode === 'weeks') {
    // In weeks mode, each day is 21px + 1px gap = 22px effective spacing
    const dayWidth = 22;
    const dayOffset = Math.round(pixelPosition / dayWidth);
    return addDateOffset(startDate, dayOffset, 'days');
  }

  const offset = Math.round(pixelPosition / columnWidth);
  return addDateOffset(startDate, offset, mode);
}

/**
 * Convert date to pixel position
 * Migrated from TimelineCalculationService.dateToPixel
 */
export function dateToPixel(
  date: Date,
  viewport: ViewportConfig
): number {
  const { startDate, columnWidth, mode } = viewport;

  if (mode === 'weeks') {
    // In weeks mode, calculate exact day offset and multiply by 22px effective spacing (21px + 1px gap)
    const dayWidth = 22;
    const dayOffset = getDateOffset(date, startDate, 'days');
    return dayOffset * dayWidth;
  }

  const offset = getDateOffset(date, startDate, mode);
  return offset * columnWidth;
}

/**
 * Calculate optimal column width based on container size
 */
export function calculateOptimalColumnWidth(
  containerWidth: number,
  desiredColumns: number,
  minColumnWidth: number = 52,
  maxColumnWidth: number = 120
): number {
  const idealWidth = containerWidth / desiredColumns;
  return Math.max(minColumnWidth, Math.min(maxColumnWidth, idealWidth));
}

/**
 * Calculate timeline zoom level constraints
 */
export function calculateZoomConstraints(
  containerWidth: number,
  totalTimespan: number
): { minZoom: number; maxZoom: number } {
  const minColumnWidth = 20;
  const maxColumnWidth = 200;

  const minZoom = containerWidth / (totalTimespan * maxColumnWidth);
  const maxZoom = containerWidth / (totalTimespan * minColumnWidth);

  return { minZoom, maxZoom };
}

/**
 * Calculate total work hours for a day
 */
export function calculateWorkHoursTotal(workHours: any[]): number {
  if (!Array.isArray(workHours)) {
    return 0;
  }
  return workHours.reduce((sum, workHour) => sum + (workHour.duration || 0), 0);
}

/**
 * Calculate left position for a day within a week
 */
export function calculateDayWidthPosition(dayWidths: number[], dayOfWeek: number): number {
  if (!Array.isArray(dayWidths) || dayOfWeek <= 0) {
    return 0;
  }
  return dayWidths.slice(0, dayOfWeek).reduce((sum, width) => sum + width, 0);
}

/**
 * Calculate baseline visual offsets for drag operations
 */
export function calculateBaselineVisualOffsets(
  positions: any,
  isDragging: boolean,
  dragState: any,
  projectId: string,
  mode: 'days' | 'weeks' = 'days'
): any {
  let adjustedPositions = { ...positions };

  if (isDragging && dragState?.projectId === projectId) {
    // In days view: use snapped daysDelta for day boundary snapping
    // In weeks view: use smooth pixelDeltaX for responsive movement
    const dayWidth = mode === 'weeks' ? 22 : 52;
    const dragOffsetPx = mode === 'days'
      ? (dragState.daysDelta || 0) * dayWidth  // Snapped to day boundaries in days view
      : (typeof dragState.pixelDeltaX === 'number' ? dragState.pixelDeltaX : (dragState.daysDelta || 0) * dayWidth);  // Smooth in weeks view

    const action = dragState?.action;

    if (action === 'move') {
      // Move everything together
      adjustedPositions = {
        ...positions,
        baselineStartPx: positions.baselineStartPx + dragOffsetPx,
        baselineWidthPx: positions.baselineWidthPx // width unchanged when moving
      };
    } else if (action === 'resize-start-date') {
      // Only start date (and baseline left edge) should move visually
      adjustedPositions = {
        ...positions,
        baselineStartPx: positions.baselineStartPx + dragOffsetPx,
        // Width must shrink/grow opposite to left edge movement to keep right edge fixed
        baselineWidthPx: positions.baselineWidthPx - dragOffsetPx
      };
    } else if (action === 'resize-end-date') {
      // Only end date should move visually; keep baseline start fixed
      adjustedPositions = {
        ...positions,
        baselineStartPx: positions.baselineStartPx,
        // Width grows/shrinks with right edge movement
        baselineWidthPx: positions.baselineWidthPx + dragOffsetPx
      };
    }
  }

  return adjustedPositions;
}

/**
 * Calculate visual project dates with consolidated offset logic
 */
export function calculateVisualProjectDates(
  project: any,
  isDragging: boolean,
  dragState: any
): { visualProjectStart: Date; visualProjectEnd: Date } {
  let visualProjectStart = new Date(project.startDate);
  // CRITICAL: For continuous projects, endDate should not be used for visuals
  // The calling code should use viewport end instead
  let visualProjectEnd = project.continuous 
    ? new Date(project.startDate) // Placeholder - caller should override with viewport end
    : new Date(project.endDate);

  // Apply drag offset based on action type for immediate visual feedback
  if (isDragging && dragState?.projectId === project.id) {
    // Use fractional daysDelta for smooth visual movement (like milestones)
    const daysOffset = dragState.daysDelta || 0;
    const action = dragState.action;

    if (action === 'move') {
      // Move both start and end (for continuous projects, only start matters)
      visualProjectStart = new Date(project.startDate);
      visualProjectStart.setDate(visualProjectStart.getDate() + daysOffset);
      
      if (!project.continuous) {
        visualProjectEnd = new Date(project.endDate);
        visualProjectEnd.setDate(visualProjectEnd.getDate() + daysOffset);
      }
    } else if (action === 'resize-start-date') {
      // Only move start date
      visualProjectStart = new Date(project.startDate);
      visualProjectStart.setDate(visualProjectStart.getDate() + daysOffset);
      // End date stays the same
    } else if (action === 'resize-end-date') {
      // Only move end date (not applicable for continuous projects)
      if (!project.continuous) {
        visualProjectEnd = new Date(project.endDate);
        visualProjectEnd.setDate(visualProjectEnd.getDate() + daysOffset);
      }
      // Start date stays the same
    }
  }

  return { visualProjectStart, visualProjectEnd };
}

/**
 * Calculate timeline bar position for a project
 */
export function calculateTimelineBarPosition(
  dates: Date[],
  project: { startDate: Date; endDate: Date }
): { startIndex: number; width: number } {
  const startIndex = dates.findIndex(date =>
    date.toDateString() === project.startDate.toDateString()
  );
  const endIndex = dates.findIndex(date =>
    date.toDateString() === project.endDate.toDateString()
  );

  return {
    startIndex: Math.max(0, startIndex),
    width: endIndex >= 0 ? (endIndex - Math.max(0, startIndex) + 1) * 48 : 0
  };
}

/**
 * Calculate week-project intersection data for weeks view
 * Extracts the logic that was causing hooks violation in TimelineBar
 */
export function calculateWeekProjectIntersection(
  date: Date,
  visualProjectStart: Date,
  visualProjectEnd: Date,
  isWorkingDay: (date: Date) => boolean
): {
  intersects: boolean;
  workingDaysInWeek: Date[];
  weekStart?: Date;
  weekEnd?: Date;
} {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Normalize project dates (using visually adjusted dates for immediate drag response)
  const projectStart = new Date(visualProjectStart);
  projectStart.setHours(0, 0, 0, 0);
  const projectEnd = new Date(visualProjectEnd);
  projectEnd.setHours(23, 59, 59, 999);

  // Check if project intersects with this week
  const weekIntersectsProject = !(projectEnd < weekStart || projectStart > weekEnd);

  if (!weekIntersectsProject) {
    return { intersects: false, workingDaysInWeek: [] };
  }

  // Calculate working days in this week that are part of the project
  const workingDaysInWeek = [];
  for (let d = new Date(Math.max(weekStart.getTime(), projectStart.getTime()));
       d <= new Date(Math.min(weekEnd.getTime(), projectEnd.getTime()));
       d.setDate(d.getDate() + 1)) {
    const normalizedDay = new Date(d);
    normalizedDay.setHours(0, 0, 0, 0);
    if (isWorkingDay(normalizedDay)) {
      workingDaysInWeek.push(normalizedDay);
    }
  }

  return { intersects: true, workingDaysInWeek, weekStart, weekEnd };
}

// ============================================================================
// MIGRATED FROM TimelineBusinessLogicService (Legacy Compatibility Functions)
// ============================================================================

/**
 * Calculate the visible project days within viewport bounds
 * Migrated from TimelineBusinessLogicService.ProjectDaysCalculationService
 */
export function calculateProjectDays(
  projectStartDate: Date,
  projectEndDate: Date,
  isContinuous: boolean,
  viewportStart: Date,
  viewportEnd: Date
): Date[] {
  // Normalize project dates to remove time components
  const projectStart = new Date(projectStartDate);
  projectStart.setHours(0, 0, 0, 0);

  // For continuous projects, use viewport end as the effective end date
  // This prevents infinite rendering while still showing the project as ongoing
  const projectEnd = isContinuous
    ? new Date(viewportEnd)
    : new Date(projectEndDate);
  projectEnd.setHours(0, 0, 0, 0);

  // Normalize viewport dates
  const normalizedViewportStart = new Date(viewportStart);
  normalizedViewportStart.setHours(0, 0, 0, 0);
  const normalizedViewportEnd = new Date(viewportEnd);
  normalizedViewportEnd.setHours(0, 0, 0, 0);

  // For continuous projects, only check if project has started
  // For regular projects, check both start and end dates
  if (isContinuous) {
    if (projectStart > normalizedViewportEnd) {
      return [];
    }
  } else {
    if (projectEnd < normalizedViewportStart || projectStart > normalizedViewportEnd) {
      return [];
    }
  }

  const projectDays = [];
  const visibleStart = projectStart < normalizedViewportStart ? normalizedViewportStart : projectStart;
  const visibleEnd = projectEnd > normalizedViewportEnd ? normalizedViewportEnd : projectEnd;

  // Debug logging for Budgi
  const debugBudgi = projectStartDate.toDateString().includes('Aug 03 2025');
  
  for (let d = new Date(visibleStart); d <= visibleEnd; d.setDate(d.getDate() + 1)) {
    const dayToAdd = new Date(d);
    dayToAdd.setHours(0, 0, 0, 0); // Normalize time component
    projectDays.push(dayToAdd);
  }

  if (debugBudgi) {
    console.log('[calculateProjectDays] Budgi project:', {
      isContinuous,
      projectStart: projectStart.toDateString(),
      projectEnd: projectEnd.toDateString(),
      normalizedViewportStart: normalizedViewportStart.toDateString(),
      normalizedViewportEnd: normalizedViewportEnd.toDateString(),
      visibleStart: visibleStart.toDateString(),
      visibleEnd: visibleEnd.toDateString(),
      generatedDaysCount: projectDays.length,
      firstDay: projectDays[0]?.toDateString(),
      lastDay: projectDays[projectDays.length - 1]?.toDateString()
    });
  }

  return projectDays;
}

/**
 * Calculate work hours for a specific day from settings
 * Migrated from TimelineBusinessLogicService.WorkHoursCalculationService
 */
export function calculateDayWorkHours(date: Date, settings: any): any[] {
  if (!settings?.weeklyWorkHours) return [];

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()] as keyof typeof settings.weeklyWorkHours;
  return settings.weeklyWorkHours[dayName] || [];
}

/**
 * Calculate total work hours for a specific day
 * Migrated from TimelineBusinessLogicService.WorkHoursCalculationService
 */
export function calculateTotalDayWorkHours(date: Date, settings: any): number {
  const dayWorkHours = calculateDayWorkHours(date, settings);
  return calculateWorkHoursTotal(dayWorkHours);
}

/**
 * SINGLE SOURCE OF TRUTH - Timeline Column Marker Calculations
 * All column marker data calculations MUST use these functions
 */

export interface TimelineColumnData {
  date: Date;
  index: number;
  columnWidth: number;
  isToday: boolean;
  isNewMonth: boolean;
  isNewWeek: boolean;
  mode: 'days' | 'weeks';
  isWeekend?: boolean;
  weekendDays?: Array<{
    leftPx: number;
    dayWidthPx: number;
    date: Date;
  }>;
  todayPositionPx?: number;
}

/**
 * Calculate column marker data for timeline columns
 * THE authoritative column marker calculation used everywhere
 */
export function calculateTimelineColumnMarkerData(
  dates: Date[], 
  mode: 'days' | 'weeks' = 'days'
): TimelineColumnData[] {
  const columnWidth = mode === 'weeks' ? 153 : 52;
  const today = new Date();
  
  return dates.map((date, index) => {
    // Check if this column represents today
    let isCurrentDay = false;
    if (mode === 'days') {
      isCurrentDay = isToday(date);
    } else {
      isCurrentDay = isTodayInWeek(date);
    }
    
    if (mode === 'weeks') {
      // Week mode: calculate month and week separators
      const prevDate = index > 0 ? dates[index - 1] : null;
      const isNewMonth = index > 0 && prevDate && date.getMonth() !== prevDate.getMonth();
      const isNewWeek = index > 0; // Every column is a new week in weeks mode
      
      // Calculate weekend day positions within week
      const weekendDays = Array.from({ length: 7 }).map((_, dayOffset) => {
        const dayDate = new Date(date);
        dayDate.setDate(date.getDate() + dayOffset);
        const isWeekendDay = isWeekendDate(dayDate);
        
        if (!isWeekendDay) return null;
        
        const leftPx = (dayOffset / 7) * columnWidth;
        const dayWidthPx = 22; // 21px day + 1px gap = 22px effective spacing
        
        return {
          leftPx,
          dayWidthPx,
          date: dayDate
        };
      }).filter(Boolean) as Array<{
        leftPx: number;
        dayWidthPx: number;
        date: Date;
      }>;
      
      // Calculate today position within week
      let todayPositionPx = 0;
      if (isCurrentDay) {
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysFromWeekStart = (dayOfWeek + 6) % 7; // Convert to Monday = 0 system
        todayPositionPx = (daysFromWeekStart / 7) * columnWidth;
      }
      
      return {
        date,
        index,
        columnWidth,
        isToday: isCurrentDay,
        isNewMonth,
        isNewWeek,
        weekendDays,
        todayPositionPx,
        mode: 'weeks' as const
      };
    } else {
      // Days mode: calculate weekend and month separators
      const isWeekend = isWeekendDate(date);
      const prevDate = index > 0 ? dates[index - 1] : null;
      const isNewMonth = index > 0 && prevDate && date.getMonth() !== prevDate.getMonth();
      const isNewWeek = index > 0 && prevDate && date.getDay() === 1; // Monday starts new week
      
      return {
        date,
        index,
        columnWidth,
        isToday: isCurrentDay,
        isWeekend,
        isNewMonth,
        isNewWeek,
        mode: 'days' as const
      };
    }
  });
}