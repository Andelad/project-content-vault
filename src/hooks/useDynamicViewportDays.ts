import { useState, useEffect, useCallback } from 'react';

const MIN_DAY_COLUMN_WIDTH = 40; // 40px minimum width per day column
const MIN_WEEK_COLUMN_WIDTH = 77; // 77px minimum width per week column (7 days × 11px)
const MIN_VIEWPORT_DAYS = 7; // Always show at least 7 days
const MAX_VIEWPORT_DAYS = 60; // Reduced from 120 for better performance
const MIN_VIEWPORT_WEEKS = 4; // Always show at least 4 weeks
const MAX_VIEWPORT_WEEKS = 30; // Reasonable cap (210 days worth)

export function useDynamicViewportDays(sidebarCollapsed: boolean, mode: 'days' | 'weeks' = 'days') {
  const [viewportDays, setViewportDays] = useState(30); // Default fallback

  const calculateViewportDays = useCallback(() => {
    // Use window dimensions as the base calculation to avoid circular dependency
    const viewportWidth = window.innerWidth;
    const sidebarWidth = 280; // Standard sidebar width
    const margins = 100; // Account for padding and margins
    const availableWidth = Math.max(600, viewportWidth - sidebarWidth - margins);
    
    if (mode === 'weeks') {
      // Calculate how many complete week columns can fit
      const completeWeekColumns = Math.floor(availableWidth / MIN_WEEK_COLUMN_WIDTH);
      
      // Add modest buffer - enough to fill screen plus some scrolling
      const weeksWithBuffer = completeWeekColumns + 8;
      
      // Clamp between min and max values, then convert to days
      const weeks = Math.max(MIN_VIEWPORT_WEEKS, Math.min(MAX_VIEWPORT_WEEKS, weeksWithBuffer));
      const days = weeks * 7;
      
      return days;
    } else {
      // Calculate how many complete day columns can fit
      const completeColumns = Math.floor(availableWidth / MIN_DAY_COLUMN_WIDTH);
      
      // Add modest buffer for days mode - reduced for better performance
      const daysWithBuffer = completeColumns + 7; // Reduced from 15
      
      // Clamp between min and max values
      const days = Math.max(MIN_VIEWPORT_DAYS, Math.min(MAX_VIEWPORT_DAYS, daysWithBuffer));
      
      // Debug logging
      console.log(`🔍 Days mode viewport calculation:`, {
        availableWidth,
        completeColumns,
        daysWithBuffer,
        finalDays: days
      });
      
      return days;
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