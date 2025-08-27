import { useState, useEffect, useCallback } from 'react';
import { TimelineViewportService } from '@/services/timelineViewportService';

export function useDynamicViewportDays(sidebarCollapsed: boolean, mode: 'days' | 'weeks' = 'days') {
  const [viewportDays, setViewportDays] = useState(30); // Default fallback

  const calculateViewportDays = useCallback(() => {
    return TimelineViewportService.calculateDynamicViewportSize({
      sidebarCollapsed,
      mode
    });
  }, [sidebarCollapsed, mode]);

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