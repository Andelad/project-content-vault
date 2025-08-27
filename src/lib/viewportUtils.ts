/**
 * @deprecated Use TimelineViewportService from @/services instead
 * 
 * This file provides backward compatibility for components that may have
 * imported viewport utilities directly. All functions delegate to the
 * centralized TimelineViewportService.
 */

import { TimelineViewportService } from '@/services/timelineViewportService';

/**
 * @deprecated Use TimelineViewportService.calculateNavigationTarget
 */
export function calculateNavigationViewport(
  currentStart: Date, 
  viewportDays: number, 
  direction: 'prev' | 'next',
  timelineMode: 'days' | 'weeks'
) {
  console.warn('calculateNavigationViewport is deprecated. Use TimelineViewportService.calculateNavigationTarget instead.');
  return TimelineViewportService.calculateNavigationTarget({
    currentViewportStart: currentStart,
    viewportDays,
    direction,
    timelineMode
  });
}

/**
 * @deprecated Use TimelineViewportService.calculateDateCenteringTarget
 */
export function calculateDateCenteringViewport(
  selectedDate: Date,
  currentStart: Date,
  viewportDays: number,
  timelineMode: 'days' | 'weeks'
) {
  console.warn('calculateDateCenteringViewport is deprecated. Use TimelineViewportService.calculateDateCenteringTarget instead.');
  return TimelineViewportService.calculateDateCenteringTarget({
    selectedDate,
    currentViewportStart: currentStart,
    viewportDays,
    timelineMode
  });
}

/**
 * @deprecated Use TimelineViewportService.calculateAnimationDuration
 */
export function calculateViewportAnimationDuration(
  startPosition: number,
  targetPosition: number,
  timelineMode: 'days' | 'weeks'
) {
  console.warn('calculateViewportAnimationDuration is deprecated. Use TimelineViewportService.calculateAnimationDuration instead.');
  return TimelineViewportService.calculateAnimationDuration(startPosition, targetPosition, timelineMode);
}

/**
 * @deprecated Use TimelineViewportService.formatDateRange
 */
export function formatViewportDateRange(startDate: Date, endDate: Date) {
  console.warn('formatViewportDateRange is deprecated. Use TimelineViewportService.formatDateRange instead.');
  return TimelineViewportService.formatDateRange(startDate, endDate);
}

/**
 * @deprecated Use TimelineViewportService.checkViewportBlocking
 */
export function isViewportBlocked() {
  console.warn('isViewportBlocked is deprecated. Use TimelineViewportService.checkViewportBlocking instead.');
  return TimelineViewportService.checkViewportBlocking().isBlocked;
}

// Re-export the service for convenience
export { TimelineViewportService };
