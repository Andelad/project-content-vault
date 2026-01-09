import React, { useState, useCallback, useEffect, useRef } from 'react';

interface ResizableSplitterProps {
  /** Current split ratio (0-1, where 0 is all top, 1 is all bottom) */
  splitRatio: number;
  /** Callback when split ratio changes */
  onSplitRatioChange: (ratio: number) => void;
  /** Minimum height for bottom section in pixels */
  minBottomHeight?: number;
  /** Maximum height for bottom section in pixels */
  maxBottomHeight?: number;
}

/**
 * ResizableSplitter - A draggable horizontal divider for resizing panels
 * 
 * Subtle horizontal line that shows a resize cursor on hover.
 */
export function ResizableSplitter({
  splitRatio,
  onSplitRatioChange,
  minBottomHeight = 100,
  maxBottomHeight = 600,
}: ResizableSplitterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startRatioRef = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startRatioRef.current = splitRatio;
    
    // Add cursor style to body while dragging
    document.body.style.cursor = 'ns-resize';
  }, [splitRatio]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current.parentElement;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerHeight = containerRect.height;
    
    // Calculate the delta from start position
    const deltaY = e.clientY - startYRef.current;
    
    // Convert delta to ratio change
    // Positive deltaY means dragging down (should decrease bottom height, increase ratio)
    const ratioChange = deltaY / containerHeight;
    
    let newRatio = startRatioRef.current + ratioChange;
    
    // Calculate bottom height from ratio
    const bottomHeight = containerHeight * (1 - newRatio);
    
    // Clamp bottom height to min/max
    const clampedBottomHeight = Math.max(
      minBottomHeight,
      Math.min(maxBottomHeight, bottomHeight)
    );
    
    // Convert back to ratio
    newRatio = 1 - (clampedBottomHeight / containerHeight);
    
    // Ensure ratio is between 0 and 1
    newRatio = Math.max(0, Math.min(1, newRatio));
    
    onSplitRatioChange(newRatio);
  }, [isDragging, onSplitRatioChange, minBottomHeight, maxBottomHeight]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={containerRef}
      className="relative h-[21px] flex items-center justify-center group cursor-ns-resize"
      onMouseDown={handleMouseDown}
    >
      {/* Border line - only visible on hover */}
      <div 
        className="absolute left-0 right-0 h-[1px] bg-transparent group-hover:bg-gray-300 transition-colors"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      />
    </div>
  );
}
