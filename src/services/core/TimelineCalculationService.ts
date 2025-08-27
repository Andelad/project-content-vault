/**
 * Timeline UI Calculation Service
 * Handles all visual positioning and sizing calculations for the timeline
 */

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

export class TimelineCalculationService {
  /**
   * Calculate position for a project bar in the timeline
   */
  static calculateProjectPosition(
    projectStart: Date,
    projectEnd: Date,
    viewport: ViewportConfig
  ): TimelinePosition {
    const { startDate, columnWidth, mode } = viewport;
    
    // Calculate left position
    const startOffset = this.getDateOffset(projectStart, startDate, mode);
    const left = Math.max(0, startOffset * columnWidth);
    
    // Calculate width
    const duration = this.getDateOffset(projectEnd, projectStart, mode) + 1;
    const width = Math.max(columnWidth * 0.8, duration * columnWidth);
    
    return { left, width };
  }

  /**
   * Calculate position for a milestone diamond
   */
  static calculateMilestonePosition(
    milestoneDate: Date,
    projectStart: Date,
    projectPosition: TimelinePosition,
    viewport: ViewportConfig
  ): TimelinePosition {
    const { mode, columnWidth } = viewport;
    
    // Calculate offset from project start
    const offsetFromProjectStart = this.getDateOffset(milestoneDate, projectStart, mode);
    
    // Determine actual day width based on mode
    const dayWidth = mode === 'weeks' ? 11 : columnWidth; // 11px per day in weeks, columnWidth in days
    const relativeLeft = offsetFromProjectStart * dayWidth;
    
    // Position milestone at END of its day column (add day width)
    const left = projectPosition.left + relativeLeft + dayWidth;
    const width = 16; // Diamond size
    const height = 16;
    
    return { left, width, height };
  }

  /**
   * Calculate row height based on project workload
   */
  static calculateRowHeight(dailyHours: number, baseHeight: number = 40): number {
    // Scale height based on daily workload
    const heightScale = Math.max(1, dailyHours / 8); // 8 hours = normal day
    return Math.min(baseHeight * heightScale, baseHeight * 3); // Cap at 3x base height
  }

  /**
   * Calculate timeline scroll position to center on date
   */
  static calculateScrollToDate(
    targetDate: Date,
    viewport: ViewportConfig,
    containerWidth: number
  ): number {
    const { startDate, columnWidth, mode } = viewport;
    const offset = this.getDateOffset(targetDate, startDate, mode);
    const targetPosition = offset * columnWidth;
    
    // Center the date in the viewport
    return Math.max(0, targetPosition - containerWidth / 2);
  }

  /**
   * Calculate visible date range for the current viewport
   */
  static calculateVisibleDateRange(
    scrollLeft: number,
    containerWidth: number,
    viewport: ViewportConfig
  ): { start: Date; end: Date } {
    const { startDate, columnWidth, mode } = viewport;
    
    const startOffset = Math.floor(scrollLeft / columnWidth);
    const endOffset = Math.ceil((scrollLeft + containerWidth) / columnWidth);
    
    const start = this.addDateOffset(startDate, startOffset, mode);
    const end = this.addDateOffset(startDate, endOffset, mode);
    
    return { start, end };
  }

  /**
   * Calculate column positions for timeline grid
   */
  static calculateColumnPositions(
    viewport: ViewportConfig,
    visibleColumns: number
  ): Array<{ date: Date; position: number; label: string }> {
    const { startDate, columnWidth, mode } = viewport;
    const columns: Array<{ date: Date; position: number; label: string }> = [];
    
    for (let i = 0; i < visibleColumns; i++) {
      const date = this.addDateOffset(startDate, i, mode);
      const position = i * columnWidth;
      const label = this.formatDateLabel(date, mode);
      
      columns.push({ date, position, label });
    }
    
    return columns;
  }

  /**
   * Calculate drag constraints for a project
   */
  static calculateDragConstraints(
    project: { startDate: Date; endDate: Date },
    viewport: ViewportConfig,
    containerBounds: { left: number; right: number }
  ): { minLeft: number; maxLeft: number } {
    const projectDuration = this.getDateOffset(project.endDate, project.startDate, viewport.mode);
    const projectWidth = projectDuration * viewport.columnWidth;
    
    return {
      minLeft: containerBounds.left,
      maxLeft: containerBounds.right - projectWidth
    };
  }

  /**
   * Convert pixel position to date
   */
  static pixelToDate(
    pixelPosition: number,
    viewport: ViewportConfig
  ): Date {
    const { startDate, columnWidth, mode } = viewport;
    
    if (mode === 'weeks') {
      // In weeks mode, each day is exactly 11px (77px ÷ 7 days = 11px per day)
      const dayWidth = 11;
      const dayOffset = Math.round(pixelPosition / dayWidth);
      return this.addDateOffset(startDate, dayOffset, 'days');
    }
    
    const offset = Math.round(pixelPosition / columnWidth);
    return this.addDateOffset(startDate, offset, mode);
  }

  /**
   * Convert date to pixel position
   */
  static dateToPixel(
    date: Date,
    viewport: ViewportConfig
  ): number {
    const { startDate, columnWidth, mode } = viewport;
    
    if (mode === 'weeks') {
      // In weeks mode, calculate exact day offset and multiply by 11px per day
      const dayWidth = 11;
      const dayOffset = this.getDateOffset(date, startDate, 'days');
      return dayOffset * dayWidth;
    }
    
    const offset = this.getDateOffset(date, startDate, mode);
    return offset * columnWidth;
  }

  /**
   * Calculate offset between two dates based on timeline mode
   */
  private static getDateOffset(
    targetDate: Date,
    baseDate: Date,
    mode: 'days' | 'weeks'
  ): number {
    const timeDiff = targetDate.getTime() - baseDate.getTime();
    const daysDiff = Math.floor(timeDiff / (24 * 60 * 60 * 1000));
    
    if (mode === 'weeks') {
      return Math.floor(daysDiff / 7);
    }
    
    return daysDiff;
  }

  /**
   * Add offset to a date based on timeline mode
   */
  private static addDateOffset(
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
   */
  private static formatDateLabel(date: Date, mode: 'days' | 'weeks'): string {
    if (mode === 'weeks') {
      const options: Intl.DateTimeFormatOptions = { 
        month: 'short', 
        day: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    } else {
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    }
  }

  /**
   * Calculate optimal column width based on container size
   */
  static calculateOptimalColumnWidth(
    containerWidth: number,
    desiredColumns: number,
    minColumnWidth: number = 40,
    maxColumnWidth: number = 120
  ): number {
    const idealWidth = containerWidth / desiredColumns;
    return Math.max(minColumnWidth, Math.min(maxColumnWidth, idealWidth));
  }

  /**
   * Calculate timeline zoom level constraints
   */
  static calculateZoomConstraints(
    containerWidth: number,
    totalTimespan: number
  ): { minZoom: number; maxZoom: number } {
    const minColumnWidth = 20;
    const maxColumnWidth = 200;
    
    const minZoom = containerWidth / (totalTimespan * maxColumnWidth);
    const maxZoom = containerWidth / (totalTimespan * minColumnWidth);
    
    return { minZoom, maxZoom };
  }
}
