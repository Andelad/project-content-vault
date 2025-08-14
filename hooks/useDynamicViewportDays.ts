import { useState, useEffect, useCallback } from 'react';

const MIN_DAY_COLUMN_WIDTH = 40; // 40px minimum width per day column
const MIN_WEEK_COLUMN_WIDTH = 72; // 72px minimum width per week column
const MIN_VIEWPORT_DAYS = 7; // Always show at least 7 days
const MAX_VIEWPORT_DAYS = 60; // Cap at 60 days for performance
const MIN_VIEWPORT_WEEKS = 4; // Always show at least 4 weeks
const MAX_VIEWPORT_WEEKS = 20; // Cap at 20 weeks for performance

export function useDynamicViewportDays(sidebarCollapsed: boolean, mode: 'days' | 'weeks' = 'days') {
  const [viewportDays, setViewportDays] = useState(30); // Default fallback

  const calculateViewportDays = useCallback(() => {
    // Get the timeline content area width
    const timelineElement = document.querySelector('.timeline-content-area');
    if (!timelineElement) {
      return mode === 'weeks' ? 28 : 30; // Fallback: 4 weeks or 30 days
    }

    const availableWidth = timelineElement.clientWidth;
    
    if (mode === 'weeks') {
      // Calculate how many complete week columns can fit
      const completeWeekColumns = Math.floor((availableWidth + 1) / (MIN_WEEK_COLUMN_WIDTH + 1));
      
      // Add 1 more week to show partial column at the end (if space allows)
      const maxWeeksWithPartial = completeWeekColumns + 1;
      
      // Clamp between min and max values, then convert to days
      const weeks = Math.max(MIN_VIEWPORT_WEEKS, Math.min(MAX_VIEWPORT_WEEKS, maxWeeksWithPartial));
      return weeks * 7; // Convert weeks to days
    } else {
      // Calculate how many complete day columns can fit
      const completeColumns = Math.floor((availableWidth + 1) / (MIN_DAY_COLUMN_WIDTH + 1));
      
      // Add 1 more day to show partial column at the end (if space allows)
      const maxDaysWithPartial = completeColumns + 1;
      
      // Clamp between min and max values
      return Math.max(MIN_VIEWPORT_DAYS, Math.min(MAX_VIEWPORT_DAYS, maxDaysWithPartial));
    }
  }, [mode]);

  const updateViewportDays = useCallback(() => {
    const newViewportDays = calculateViewportDays();
    setViewportDays(newViewportDays);
  }, [calculateViewportDays]);

  useEffect(() => {
    // Initial calculation
    updateViewportDays();

    // Set up resize observer for the timeline content area
    const timelineElement = document.querySelector('.timeline-content-area');
    if (!timelineElement) return;

    const resizeObserver = new ResizeObserver(() => {
      updateViewportDays();
    });

    resizeObserver.observe(timelineElement);

    // Also listen for window resize as backup
    const handleResize = () => {
      // Small delay to ensure DOM updates are complete
      setTimeout(updateViewportDays, 100);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [updateViewportDays]);

  // Recalculate when sidebar state changes or mode changes
  useEffect(() => {
    // Small delay to allow sidebar transition to complete
    const timer = setTimeout(updateViewportDays, 350); // Slightly longer than transition duration
    return () => clearTimeout(timer);
  }, [sidebarCollapsed, mode, updateViewportDays]);

  return viewportDays;
}