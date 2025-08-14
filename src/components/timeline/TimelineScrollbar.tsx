import React, { useState, useRef, useEffect, memo } from 'react';

interface TimelineScrollbarProps {
  viewportStart: Date;
  setViewportStart: (date: Date) => void;
  setCurrentDate: (date: Date) => void;
  VIEWPORT_DAYS: number;
  isAnimating: boolean;
  setIsAnimating: (animating: boolean) => void;
}

export const TimelineScrollbar = memo(function TimelineScrollbar({ 
  viewportStart, 
  setViewportStart, 
  setCurrentDate, 
  VIEWPORT_DAYS,
  isAnimating,
  setIsAnimating
}: TimelineScrollbarProps) {
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [isDraggingThumb, setIsDraggingThumb] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartOffset, setDragStartOffset] = useState(0);
  const [smoothThumbPosition, setSmoothThumbPosition] = useState(0);
  
  const TOTAL_DAYS = 365; // Full year
  
  // Calculate full timeline start (January 1st of current year)
  const fullTimelineStart = new Date(viewportStart.getFullYear(), 0, 1);
  
  // Calculate current day offset from start of year
  const currentDayOffset = Math.round((viewportStart.getTime() - fullTimelineStart.getTime()) / (24 * 60 * 60 * 1000));
  
  // Calculate thumb position and size as percentages
  const maxOffset = TOTAL_DAYS - VIEWPORT_DAYS;
  const calculatedThumbPosition = maxOffset > 0 ? (currentDayOffset / maxOffset) * 100 : 0;
  const thumbWidth = (VIEWPORT_DAYS / TOTAL_DAYS) * 100;
  
  // Use smooth position during animations, otherwise use calculated position
  const thumbPosition = isAnimating ? smoothThumbPosition : calculatedThumbPosition;
  
  // Update smooth position when not animating
  useEffect(() => {
    if (!isAnimating) {
      setSmoothThumbPosition(calculatedThumbPosition);
    }
  }, [calculatedThumbPosition, isAnimating]);
  
  const handleScrollbarClick = (e: React.MouseEvent) => {
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
    
    // Dynamic animation duration based on distance - extended for smooth landing approach
    const baseDuration = 500;
    const distanceMultiplier = Math.min(daysDifference * 40, 1200); // Up to 1200ms extra for long distances
    const animationDuration = baseDuration + distanceMultiplier;
    const startTime = performance.now();
    
    setIsAnimating(true);
    
    // Calculate target thumb position for smooth scrollbar animation
    const targetThumbPosition = maxOffset > 0 ? (targetDayOffset / maxOffset) * 100 : 0;
    const startThumbPosition = smoothThumbPosition;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Three-phase airplane-like easing with extended landing approach
      let easedProgress;
      
      if (progress < 0.25) {
        // Takeoff phase (0-25%): Gentle acceleration
        const phaseProgress = progress / 0.25;
        easedProgress = 0.25 * phaseProgress * phaseProgress; // Quadratic ease-in, reaches 25% distance at 25% time
      } else if (progress < 0.65) {
        // Flight phase (25-65%): Sustained high speed
        const phaseProgress = (progress - 0.25) / 0.4;
        easedProgress = 0.25 + 0.55 * phaseProgress; // Linear from 25% to 80% distance
      } else {
        // Extended landing phase (65-100%): Long, gentle approach covering 20% of distance
        const phaseProgress = (progress - 0.65) / 0.35;
        
        // Super gentle quintic ease-out for extended gliding
        // Quintic provides even gentler deceleration than quartic
        const quinticsEase = 1 - Math.pow(1 - phaseProgress, 5);
        
        // Additional exponential smoothing for ultra-gentle final approach
        const expSmoothing = 1 - Math.exp(-3 * phaseProgress);
        
        // Combine both for maximum smoothness, weighted toward exponential for gentleness
        const ultraGentleDecel = (quinticsEase * 0.3) + (expSmoothing * 0.7);
        
        easedProgress = 0.8 + 0.2 * ultraGentleDecel; // From 80% to 100% distance over 35% time
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
  };
  
  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingThumb(true);
    setDragStartX(e.clientX);
    setDragStartOffset(currentDayOffset);
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDraggingThumb || !scrollbarRef.current) return;
    
    const rect = scrollbarRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStartX;
    const deltaRatio = deltaX / rect.width;
    const deltaDays = Math.round(deltaRatio * maxOffset);
    
    const newDayOffset = Math.max(0, Math.min(maxOffset, dragStartOffset + deltaDays));
    
    const newViewportStart = new Date(fullTimelineStart);
    newViewportStart.setDate(fullTimelineStart.getDate() + newDayOffset);
    setViewportStart(newViewportStart);
    setCurrentDate(new Date(newViewportStart));
  };
  
  const handleMouseUp = () => {
    setIsDraggingThumb(false);
  };
  
  // Add global mouse event listeners for thumb dragging
  useEffect(() => {
    if (isDraggingThumb) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingThumb, dragStartX, dragStartOffset, maxOffset, fullTimelineStart, setViewportStart, setCurrentDate]);
  
  return (
    <div className="py-1 border-t border-gray-200 flex-shrink-0" style={{ height: '32px' }}>
      <div 
        className="h-3 bg-gray-200 rounded-full relative cursor-pointer select-none mt-1" 
        ref={scrollbarRef} 
        onClick={handleScrollbarClick}
      >
        <div 
          ref={thumbRef}
          className="absolute h-full bg-blue-500 rounded-full cursor-grab active:cursor-grabbing transition-colors hover:bg-blue-600"
          style={{
            left: `${Math.max(0, Math.min(100 - thumbWidth, thumbPosition))}%`,
            width: `${thumbWidth}%`
          }}
          onMouseDown={handleThumbMouseDown}
        />
      </div>
    </div>
  );
});