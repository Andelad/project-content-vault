/**
 * useHoverableDateHeaders
 * 
 * Custom hook for adding interactive hover effects to calendar date headers.
 * Allows clicking headers to navigate to Timeline view at that date.
 * 
 * Architecture:
 * - Manages DOM manipulation for header cells
 * - Coordinates hover state and tooltips
 * - Handles navigation to Timeline
 */

import { useEffect } from 'react';
import { NEUTRAL_COLORS } from '@/constants/colors';

interface UseHoverableDateHeadersProps {
  calendarDate: Date;
  currentView: 'week' | 'day';
  setCurrentDate: (date: Date) => void;
  setTimelineView: (view: string) => void;
}

export function useHoverableDateHeaders({
  calendarDate,
  currentView,
  setCurrentDate,
  setTimelineView
}: UseHoverableDateHeadersProps) {
  useEffect(() => {
    const addHoverableHeaders = () => {
      // Find all column header cells
      const headerCells = document.querySelectorAll('.fc-col-header-cell');
      
      headerCells.forEach((cell) => {
        // Skip if already processed
        if (cell.hasAttribute('data-hoverable-processed')) return;
        
        // Mark as processed
        cell.setAttribute('data-hoverable-processed', 'true');
        
        // Get the date for this cell
        const dateAttr = cell.getAttribute('data-date');
        if (!dateAttr) return;
        
        const cellDate = new Date(dateAttr);
        
        // State variables for hover management
        let isHovered = false;
        let hoverOverlay: HTMLElement | null = null;
        let tooltip: HTMLElement | null = null;
        let hoverTimeout: NodeJS.Timeout | null = null;
        
        const handleMouseEnter = () => {
          if (isHovered) return;
          isHovered = true;
          
          // Add 300ms delay to match React tooltip
          hoverTimeout = setTimeout(() => {
            if (!isHovered) return;
            
            // Create and append hover overlay
            hoverOverlay = document.createElement('div');
            hoverOverlay.className = 'absolute inset-0 flex items-center justify-center pointer-events-none z-50';
            hoverOverlay.innerHTML = `
              <div class="bg-white bg-opacity-90 rounded-full p-1 shadow-sm border">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="21" y1="6" x2="3" y2="6"></line>
                  <line x1="15" y1="12" x2="3" y2="12"></line>
                  <line x1="17" y1="18" x2="3" y2="18"></line>
                </svg>
              </div>
            `;
            
            // Create tooltip
            tooltip = document.createElement('div');
            const cellRect = cell.getBoundingClientRect();
            tooltip.style.cssText = `
              position: fixed;
              top: ${cellRect.top - 40}px;
              left: ${cellRect.left + cellRect.width / 2}px;
              transform: translateX(-50%) scale(0.95);
              background: ${NEUTRAL_COLORS.gray50};
              color: ${NEUTRAL_COLORS.gray800};
              border: 1px solid ${NEUTRAL_COLORS.gray200};
              border-radius: 6px;
              padding: 6px 12px;
              font-size: 14px;
              white-space: nowrap;
              pointer-events: none;
              z-index: 99999;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
              opacity: 0;
              transition: opacity 150ms ease-in-out, transform 150ms ease-in-out;
            `;
            tooltip.innerHTML = 'Go to Timeline';
            
            // Make cell content semi-transparent
            const cellContent = cell.querySelector('.fc-col-header-cell-cushion');
            if (cellContent) {
              (cellContent as HTMLElement).style.opacity = '0.3';
            }
            
            // Make cell position relative for overlay positioning
            (cell as HTMLElement).style.position = 'relative';
            (cell as HTMLElement).style.cursor = 'pointer';
            
            cell.appendChild(hoverOverlay);
            document.body.appendChild(tooltip);
            
            // Trigger animation
            requestAnimationFrame(() => {
              if (tooltip) {
                tooltip.style.opacity = '1';
                tooltip.style.transform = 'translateX(-50%) scale(1)';
              }
            });
          }, 300);
        };
        
        const handleMouseLeave = () => {
          if (!isHovered) return;
          isHovered = false;
          
          // Clear timeout if still pending
          if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
          }
          
          // Remove hover overlay
          if (hoverOverlay) {
            hoverOverlay.remove();
            hoverOverlay = null;
          }
          
          // Remove tooltip with fade out
          if (tooltip) {
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateX(-50%) scale(0.95)';
            setTimeout(() => {
              if (tooltip) {
                tooltip.remove();
                tooltip = null;
              }
            }, 150);
          }
          
          // Restore cell content opacity
          const cellContent = cell.querySelector('.fc-col-header-cell-cushion');
          if (cellContent) {
            (cellContent as HTMLElement).style.opacity = '1';
          }
        };
        
        const handleClick = () => {
          // Navigate to timeline at the specified date
          setCurrentDate(new Date(cellDate));
          setTimelineView('timeline');
        };
        
        // Add event listeners
        cell.addEventListener('mouseenter', handleMouseEnter);
        cell.addEventListener('mouseleave', handleMouseLeave);
        cell.addEventListener('click', handleClick);
      });
    };
    
    // Add headers after a short delay to ensure calendar is rendered
    const timeoutId = setTimeout(addHoverableHeaders, 100);
    
    return () => {
      clearTimeout(timeoutId);
      
      // Clean up any processed headers
      const headerCells = document.querySelectorAll('.fc-col-header-cell[data-hoverable-processed]');
      headerCells.forEach((cell) => {
        cell.removeAttribute('data-hoverable-processed');
        (cell as HTMLElement).style.position = '';
        (cell as HTMLElement).style.cursor = '';
        const cellContent = cell.querySelector('.fc-col-header-cell-cushion');
        if (cellContent) {
          (cellContent as HTMLElement).style.opacity = '';
        }
      });
    };
  }, [calendarDate, currentView, setCurrentDate, setTimelineView]);
}
