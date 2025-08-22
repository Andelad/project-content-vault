import React, { useState, useRef, useEffect, memo, useCallback } from 'react';

interface HoverableTimelineScrollbarProps {
  viewportStart: Date;
  setViewportStart: (date: Date) => void;
  setCurrentDate: (date: Date) => void;
  VIEWPORT_DAYS: number;
  isAnimating: boolean;
  setIsAnimating: (animating: boolean) => void;
  sidebarWidth?: number; // Optional prop to control left offset
  bottomOffset?: number; // Optional prop to control bottom positioning (default 48px for holiday row)
  // NEW: Add props to coordinate with other timeline systems
  isDragging?: boolean; // From timeline's drag state
  stopAutoScroll?: () => void; // Function to stop timeline's auto-scroll
}

export const HoverableTimelineScrollbar = memo(function HoverableTimelineScrollbar({ 
  viewportStart, 
  setViewportStart, 
  setCurrentDate, 
  VIEWPORT_DAYS,
  isAnimating,
  setIsAnimating,
  sidebarWidth,
  bottomOffset = 48,
  isDragging: timelineDragging = false,
  stopAutoScroll
}: HoverableTimelineScrollbarProps) {
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  
  // SIMPLE drag tracking
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartDayOffset = useRef(0);
  const scrollbarWidth = useRef(0);
  const finalDragPosition = useRef<number | null>(null); // Store final drag position
  const justFinishedDrag = useRef(false); // Flag to prevent clicks after drag
  
  // Store original setViewportStart
  const originalSetViewportStart = useRef(setViewportStart);
  const blockedUpdateCount = useRef(0);
  
  const [isDraggingThumb, setIsDraggingThumb] = useState(false);
  const [smoothThumbPosition, setSmoothThumbPosition] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  
  // Use a year-based timeline but adapt to content length
  const TOTAL_DAYS = Math.max(365, VIEWPORT_DAYS * 2); // At least a year, or double the viewport
  
  // Calculate full timeline start (January 1st of current year)
  const fullTimelineStart = new Date(viewportStart.getFullYear(), 0, 1);
  
  // Calculate current day offset from start of year
  const currentDayOffset = Math.round((viewportStart.getTime() - fullTimelineStart.getTime()) / (24 * 60 * 60 * 1000));
  
  // Calculate thumb position and size as percentages
  const maxOffset = TOTAL_DAYS - VIEWPORT_DAYS;
  const calculatedThumbPosition = maxOffset > 0 ? (currentDayOffset / maxOffset) * 100 : 0;
  
  // Make thumb much smaller for weeks mode - represent actual visible content better
  const effectiveViewportDays = VIEWPORT_DAYS > 200 ? Math.min(VIEWPORT_DAYS / 8, 30) : VIEWPORT_DAYS;
  const thumbWidth = (effectiveViewportDays / TOTAL_DAYS) * 100;
  
  // Use smooth position during animations, but NOT during dragging
  const thumbPosition = (isAnimating && !isDraggingThumb) ? smoothThumbPosition : calculatedThumbPosition;
  
  // Keep original function reference updated
  useEffect(() => {
    originalSetViewportStart.current = setViewportStart;
  }, [setViewportStart]);
  
  // INTERCEPT all external viewport updates during drag
  useEffect(() => {
    if (isDragging.current) {
      // Override the global setViewportStart during drag
      const originalFn = originalSetViewportStart.current;
      
      // Create a blocking wrapper
      const blockingWrapper = (date: Date) => {
        blockedUpdateCount.current++;
        console.log(`🚫 BLOCKED external viewport update #${blockedUpdateCount.current} during drag`);
        // Don't call the original function - just block it
      };
      
      // This is a hack but necessary - replace the function temporarily
      if (typeof setViewportStart === 'function') {
        // Store the blocking function
        (window as any).__budgiScrollbarBlocking = true;
      }
      
      return () => {
        // Restore original function when drag ends
        (window as any).__budgiScrollbarBlocking = false;
      };
    }
  }, [isDragging.current, setViewportStart]);
  
  // Update smooth position when not dragging, but respect final drag position
  // Allow updates during external animations (like Today button) and normal scrolling
  useEffect(() => {
    if (!isDraggingThumb) {
      // Reset final drag position after a short delay to allow normal updates
      if (finalDragPosition.current !== null) {
        const resetTimer = setTimeout(() => {
          finalDragPosition.current = null;
        }, 100);
        return () => clearTimeout(resetTimer);
      }
      setSmoothThumbPosition(calculatedThumbPosition);
    }
  }, [calculatedThumbPosition, isDraggingThumb]);
  
  const updateViewportFromDayOffset = useCallback((dayOffset: number) => {
    const clampedDayOffset = Math.max(0, Math.min(maxOffset, dayOffset));
    const newViewportStart = new Date(fullTimelineStart);
    newViewportStart.setDate(fullTimelineStart.getDate() + clampedDayOffset);
    
    setViewportStart(newViewportStart);
    setCurrentDate(new Date(newViewportStart));
    
    // Update thumb position to match - THIS IS THE FINAL POSITION
    const newThumbPosition = maxOffset > 0 ? (clampedDayOffset / maxOffset) * 100 : 0;
    setSmoothThumbPosition(newThumbPosition);
    finalDragPosition.current = newThumbPosition; // Lock this position
  }, [maxOffset, fullTimelineStart, setViewportStart, setCurrentDate]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!scrollbarRef.current) return;
    
    console.log('🎯 SCROLLBAR DRAG START', {
      timelineDragging,
      scrollbarDragging: isDragging.current,
      clientX: e.clientX
    });
    
    // Stop any timeline auto-scrolling
    if (stopAutoScroll) {
      stopAutoScroll();
    }
    
    // Clear any previous final position
    finalDragPosition.current = null;
    
    // Store initial state
    const rect = scrollbarRef.current.getBoundingClientRect();
    scrollbarWidth.current = rect.width;
    dragStartX.current = e.clientX;
    dragStartDayOffset.current = currentDayOffset;
    
    // Set drag state
    isDragging.current = true;
    setIsDraggingThumb(true);
    setIsAnimating(false);
    
    // Reset blocked update counter
    blockedUpdateCount.current = 0;
  }, [currentDayOffset, setIsAnimating, stopAutoScroll]);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    
    console.log('📍 SCROLLBAR DRAG MOVE', {
      deltaX: e.clientX - dragStartX.current,
      scrollbarWidth: scrollbarWidth.current
    });
    
    e.preventDefault();
    
    // Calculate position change
    const deltaX = e.clientX - dragStartX.current;
    const deltaPercent = (deltaX / scrollbarWidth.current) * 100;
    const deltaDays = Math.round((deltaPercent / 100) * maxOffset);
    
    // Calculate new day offset
    const newDayOffset = dragStartDayOffset.current + deltaDays;
    
    console.log('📍 SCROLLBAR updating viewport', {
      deltaDays,
      newDayOffset,
      maxOffset
    });
    
    // Update viewport immediately
    updateViewportFromDayOffset(newDayOffset);
  }, [maxOffset, updateViewportFromDayOffset]);
  
  const handleMouseUp = useCallback((e?: MouseEvent) => {
    if (!isDragging.current) return;
    
    console.log('🏁 SCROLLBAR DRAG END - Position locked at:', finalDragPosition.current);
    
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Clear drag state
    isDragging.current = false;
    setIsDraggingThumb(false);
    
    // PREVENT clicks immediately after drag ends
    justFinishedDrag.current = true;
    setTimeout(() => {
      justFinishedDrag.current = false;
    }, 100); // Block clicks for 100ms after drag
    
    // DO NOT change anything about the position here
    // The final position was already set in updateViewportFromDayOffset
    // Just clear the lock after a brief moment to allow normal updates
    setTimeout(() => {
      finalDragPosition.current = null;
    }, 50); // Very short timeout just to prevent immediate external updates
    
  }, []);
  
  // Global mouse event listeners
  useEffect(() => {
    if (isDraggingThumb) {
      const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
      const handleGlobalMouseUp = (e: MouseEvent) => handleMouseUp(e);
      
      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
      document.addEventListener('mouseup', handleGlobalMouseUp, { passive: false });
      document.addEventListener('mouseleave', handleGlobalMouseUp);
      
      // Also handle pointer events for better pen/stylus support
      document.addEventListener('pointermove', handleGlobalMouseMove as any, { passive: false });
      document.addEventListener('pointerup', handleGlobalMouseUp as any, { passive: false });
      document.addEventListener('pointercancel', handleGlobalMouseUp as any);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('mouseleave', handleGlobalMouseUp);
        document.removeEventListener('pointermove', handleGlobalMouseMove as any);
        document.removeEventListener('pointerup', handleGlobalMouseUp as any);
        document.removeEventListener('pointercancel', handleGlobalMouseUp as any);
      };
    }
  }, [isDraggingThumb, handleMouseMove, handleMouseUp]);
  
  const handleScrollbarClick = useCallback((e: React.MouseEvent) => {
    // BLOCK clicks immediately after drag operation
    if (justFinishedDrag.current) {
      console.log('🚫 BLOCKED click after drag - preventing jump');
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    if (!scrollbarRef.current || isDraggingThumb || isAnimating) return;
    
    const rect = scrollbarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = clickX / rect.width;
    const targetDayOffset = Math.round(clickRatio * maxOffset);
    
    const targetViewportStart = new Date(fullTimelineStart);
    targetViewportStart.setDate(fullTimelineStart.getDate() + targetDayOffset);
    
    // Calculate the difference in days for smooth animation
    const currentStart = viewportStart.getTime();
    const targetStart = targetViewportStart.getTime();
    const daysDifference = Math.abs((targetStart - currentStart) / (24 * 60 * 60 * 1000));
    
    // If already close to target, don't animate
    if (daysDifference < 1) {
      setViewportStart(targetViewportStart);
      setCurrentDate(new Date(targetViewportStart));
      return;
    }
    
    // Dynamic animation duration based on distance
    const baseDuration = 500;
    const distanceMultiplier = Math.min(daysDifference * 40, 1200);
    const animationDuration = baseDuration + distanceMultiplier;
    const startTime = performance.now();
    
    setIsAnimating(true);
    
    // Calculate target thumb position for smooth scrollbar animation
    const targetThumbPosition = maxOffset > 0 ? (targetDayOffset / maxOffset) * 100 : 0;
    const startThumbPosition = smoothThumbPosition;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Three-phase airplane-like easing
      let easedProgress;
      
      if (progress < 0.25) {
        // Takeoff phase (0-25%): Gentle acceleration
        const phaseProgress = progress / 0.25;
        easedProgress = 0.25 * phaseProgress * phaseProgress;
      } else if (progress < 0.65) {
        // Flight phase (25-65%): Sustained high speed
        const phaseProgress = (progress - 0.25) / 0.4;
        easedProgress = 0.25 + 0.55 * phaseProgress;
      } else {
        // Extended landing phase (65-100%): Long, gentle approach
        const phaseProgress = (progress - 0.65) / 0.35;
        const quinticsEase = 1 - Math.pow(1 - phaseProgress, 5);
        const expSmoothing = 1 - Math.exp(-3 * phaseProgress);
        const ultraGentleDecel = (quinticsEase * 0.3) + (expSmoothing * 0.7);
        easedProgress = 0.8 + 0.2 * ultraGentleDecel;
      }
      
      // Calculate intermediate viewport start
      const currentOffset = currentStart + (targetStart - currentStart) * easedProgress;
      const intermediateStart = new Date(currentOffset);
      
      // Smoothly animate thumb position
      const intermediateThumbPosition = startThumbPosition + (targetThumbPosition - startThumbPosition) * easedProgress;
      setSmoothThumbPosition(intermediateThumbPosition);
      
      setViewportStart(intermediateStart);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure we end up exactly at the target
        setViewportStart(targetViewportStart);
        setCurrentDate(new Date(targetViewportStart));
        setSmoothThumbPosition(targetThumbPosition);
        setIsAnimating(false);
      }
    };
    
    requestAnimationFrame(animate);
  }, [isDraggingThumb, isAnimating, maxOffset, fullTimelineStart, viewportStart, setViewportStart, setCurrentDate, smoothThumbPosition, setIsAnimating]);
  
  // Calculate positioning - full width minus sidebar and padding
  const leftOffset = sidebarWidth || 0;
  const rightPadding = 21; // 21px padding on right
  const leftPadding = 21; // 21px padding on left from timeline content
  
  return (
    <div 
      className="absolute right-0 h-6 flex items-center z-30 pointer-events-none"
      style={{ 
        left: `${leftOffset + leftPadding}px`, 
        right: `${rightPadding}px`,
        bottom: `${bottomOffset + 6}px` // 6px above the bottom offset
      }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => !isDraggingThumb && setIsVisible(false)}
    >
      {/* Hover detection area - larger for easier hover */}
      <div 
        className="absolute pointer-events-auto"
        style={{
          left: '-10px',
          right: '-10px', 
          top: '-10px',
          bottom: '-10px'
        }}
      />
      
      {/* Scrollbar container */}
      <div 
        className={`w-full transition-opacity duration-75 ease-in-out pointer-events-auto ${
          isVisible || isDraggingThumb ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div 
          className="h-3 rounded-full relative cursor-pointer select-none" 
          style={{ 
            background: 'rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(4px)'
          }}
          ref={scrollbarRef} 
          onClick={handleScrollbarClick}
        >
          <div 
            ref={thumbRef}
            className="absolute h-full rounded-full cursor-grab active:cursor-grabbing"
            style={{
              left: `${Math.max(0, Math.min(100 - thumbWidth, thumbPosition))}%`,
              width: `${thumbWidth}%`,
              background: '#a1a1aa',
              userSelect: 'none'
            }}
            onMouseDown={handleMouseDown}
          />
        </div>
      </div>
    </div>
  );
});