import { useEffect, useRef } from 'react';

interface UseSwipeNavigationOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  /** Minimum distance in pixels to trigger swipe (default: 50) */
  minSwipeDistance?: number;
  /** Whether swipe is enabled */
  enabled?: boolean;
}

/**
 * Hook for handling touch swipe gestures
 * Returns a ref to attach to the swipeable element
 */
export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  minSwipeDistance = 50,
  enabled = true
}: UseSwipeNavigationOptions) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Prevent default scrolling behavior during horizontal swipe
      if (touchStartX.current !== null && touchStartY.current !== null) {
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = Math.abs(currentX - touchStartX.current);
        const diffY = Math.abs(currentY - touchStartY.current);
        
        // If horizontal movement is greater than vertical, prevent default scroll
        if (diffX > diffY && diffX > 10) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const diffX = touchStartX.current - touchEndX;
      const diffY = touchStartY.current - touchEndY;
      
      // Calculate absolute distances
      const absDiffX = Math.abs(diffX);
      const absDiffY = Math.abs(diffY);
      
      // Only trigger swipe if horizontal movement is greater than vertical
      // This prevents triggering during vertical scrolling
      if (absDiffX > absDiffY && absDiffX > minSwipeDistance) {
        if (diffX > 0) {
          // Swiped left (next)
          onSwipeLeft();
        } else {
          // Swiped right (previous)
          onSwipeRight();
        }
      }

      // Reset
      touchStartX.current = null;
      touchStartY.current = null;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, minSwipeDistance, enabled]);

  return elementRef;
}
