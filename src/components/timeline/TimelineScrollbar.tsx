import React, { useRef, useState, useEffect, memo } from 'react';
import { 
  calculateScrollbarPosition, 
  calculateScrollbarClickTarget,
  calculateScrollbarDragTarget,
  calculateScrollEasing,
  calculateAnimationDuration
} from '@/services';

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
  
  // Use service for scrollbar calculations
  const scrollbarCalc = calculateScrollbarPosition(viewportStart, VIEWPORT_DAYS);
  const { 
    fullTimelineStart, 
    currentDayOffset, 
    thumbPosition: calculatedThumbPosition, 
    thumbWidth, 
    maxOffset 
  } = scrollbarCalc;
  
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
    
    // Use service to calculate target viewport
    const targetViewportStart = calculateScrollbarClickTarget(
      clickX, 
      rect.width, 
      fullTimelineStart, 
      maxOffset
    );
    
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
    
    // Use service for animation duration calculation
    const animationDuration = calculateAnimationDuration(currentStart, targetStart);
    const startTime = performance.now();
    
    setIsAnimating(true);
    
    // Calculate target thumb position for smooth scrollbar animation
    const targetThumbPosition = maxOffset > 0 ? 
      ((targetViewportStart.getTime() - fullTimelineStart.getTime()) / (24 * 60 * 60 * 1000) / maxOffset) * 100 : 0;
    const startThumbPosition = smoothThumbPosition;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Use service for easing calculation
      const easedProgress = calculateScrollEasing(progress);
      
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
    
    // Use service to calculate new viewport position
    const newViewportStart = calculateScrollbarDragTarget(
      deltaX,
      rect.width,
      dragStartOffset,
      maxOffset,
      fullTimelineStart
    );
    
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