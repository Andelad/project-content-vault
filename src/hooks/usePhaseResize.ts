/**
 * usePhaseResize Hook
 * 
 * Custom hook for handling phase boundary resize operations (start/end date).
 * Follows the same pattern as useProjectResize but enforces phase-specific rules:
 * - Phases cannot overlap
 * - Minimum 1 day per phase
 * - Cannot drag past adjacent phase boundaries
 * - First phase start locked to project start
 * - Last phase end locked to project end
 * 
 * Following AI Dev Rules pattern:
 * - Hook manages React state + coordinates services
 * - PhaseRules domain class handles validation
 * - Updates only on mouse release (not live)
 * 
 * Created: November 2025
 */
import { useCallback } from 'react';
import { toast } from './use-toast';
import {
  addDaysToDate,
  normalizeToMidnight,
  calculateDaysDeltaFromPixels
} from '@/services';
import type { DragState } from '@/services/ui/DragPositioning';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
import { getPhases, type Phase } from '@/domain/rules/PhaseRules';
import type { Phase, Project } from '@/types/core';

type UpdateMilestoneFn = (
  id: string,
  updates: Partial<Phase>,
  options?: { silent?: boolean }
) => Promise<unknown>;

interface UsePhaseResizeProps {
  projects: Project[];
  phases: Phase[];
  dates: Date[];
  viewportStart: Date;
  viewportEnd: Date;
  timelineMode: 'days' | 'weeks';
  updatePhase: UpdateMilestoneFn;
  checkAutoScroll: (clientX: number) => void;
  stopAutoScroll: () => void;
  setIsDragging: (dragging: boolean) => void;
  setDragState: (state: DragState | null) => void;
  dragState: DragState | null;
}

/**
 * Initialize drag state for phase resize
 */
function initializePhaseResizeDragState(
  projectId: string,
  phaseId: string,
  originalStartDate: Date,
  originalEndDate: Date,
  startX: number,
  startY: number,
  action: 'resize-phase-start' | 'resize-phase-end',
  mode: 'days' | 'weeks'
): DragState {
  return {
    projectId,
    milestoneId: phaseId,
    action,
    startX,
    startY,
    originalStartDate: new Date(originalStartDate),
    originalEndDate: new Date(originalEndDate),
    lastDaysDelta: 0,
    mode
  };
}

/**
 * Calculate bounds for phase resize based on adjacent phases
 */
function calculatePhaseBounds(
  phases: Phase[],
  currentPhase: Phase,
  action: 'resize-phase-start' | 'resize-phase-end'
): { minDate: Date | null; maxDate: Date | null } {
  const sortedPhases = [...phases].sort((a, b) => 
    new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime()
  );
  
  const currentIndex = sortedPhases.findIndex(p => p.id === currentPhase.id);
  
  if (action === 'resize-phase-start') {
    // When moving start date:
    // - Min: day after previous phase ends (or null if first phase - locked to project start)
    // - Max: one day before current phase end (minimum 1 day duration)
  const prevPhase = currentIndex > 0 ? sortedPhases[currentIndex - 1] : null;
    const minDate = prevPhase ? addDaysToDate(new Date(prevPhase.endDate!), 1) : null;
    const maxDate = addDaysToDate(new Date(currentPhase.endDate!), -1); // At least 1 day
    
    return { minDate, maxDate };
  } else {
    // When moving end date:
    // - Min: one day after current phase start (minimum 1 day duration)
    // - Max: day before next phase starts (or null if last phase - locked to project end)
  const nextPhase = currentIndex < sortedPhases.length - 1 ? sortedPhases[currentIndex + 1] : null;
    const minDate = addDaysToDate(new Date(currentPhase.startDate!), 1); // At least 1 day
    const maxDate = nextPhase ? addDaysToDate(new Date(nextPhase.startDate!), -1) : null;
    
    return { minDate, maxDate };
  }
}

/**
 * Custom hook for handling phase boundary resize operations
 * Manages state and coordinates with domain rules
 */
export function usePhaseResize({
  projects,
  phases,
  dates,
  viewportStart,
  viewportEnd,
  timelineMode,
  updatePhase,
  checkAutoScroll,
  stopAutoScroll,
  setIsDragging,
  setDragState,
  dragState
}: UsePhaseResizeProps) {
  
  const handlePhaseResizeMouseDown = useCallback((
    e: React.MouseEvent, 
    projectId: string,
    phaseId: string,
    action: 'resize-phase-start' | 'resize-phase-end'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Get all phases for this project
    const projectPhases = milestones.filter(p => m.projectId === projectId);
    const phases = getPhases(projectPhases);

    // Find the phase being resized
    const targetPhase = phases.find(p => m.id === phaseId);
    if (!targetPhase) {
      return;
    }
    
    // Check if project has recurring template (should be blocked by UI but double-check)
    const hasRecurring = projectPhases.some(p => m.isRecurring);
    if (hasRecurring) {
      toast({
        title: "Cannot adjust phase dates",
        description: "This project uses a recurring template. Edit the template to change phase dates.",
        variant: "destructive"
      });
      return;
    }
    
    // Initialize drag state
    const initialDragState = initializePhaseResizeDragState(
      projectId,
      phaseId,
      new Date(targetPhase.startDate),
      new Date(targetPhase.endDate!),
      e.clientX,
      e.clientY,
      action,
      timelineMode
    );
    
    setIsDragging(true);
    setDragState(initialDragState);
    
  let currentDragStateRef = initialDragState;
    
    const handleMouseMove = (e: MouseEvent) => {
      try {
        e.preventDefault();
        
        // Calculate days delta from mouse movement
        const deltaX = e.clientX - currentDragStateRef.startX;
        const daysDelta = calculateDaysDeltaFromPixels(
          deltaX,
          currentDragStateRef.mode || 'days'
        );
        
        // Skip if no change
        if (daysDelta === currentDragStateRef.lastDaysDelta) {
          return;
        }
        
        // Calculate new date based on action
        const newDate = action === 'resize-phase-start'
          ? addDaysToDate(new Date(currentDragStateRef.originalStartDate), daysDelta)
          : addDaysToDate(new Date(currentDragStateRef.originalEndDate), daysDelta);
        
        // Get bounds based on adjacent phases
  const bounds = calculatePhaseBounds(phases, targetPhase, action);
        
        // Apply bounds validation
        let constrainedDate = normalizeToMidnight(newDate);
        
        if (bounds.minDate && constrainedDate < bounds.minDate) {
          constrainedDate = bounds.minDate;
        }
        if (bounds.maxDate && constrainedDate > bounds.maxDate) {
          constrainedDate = bounds.maxDate;
        }
        
        // Calculate final days delta based on constrained date
        const originalDate = action === 'resize-phase-start'
          ? new Date(currentDragStateRef.originalStartDate)
          : new Date(currentDragStateRef.originalEndDate);
        const constrainedDaysDelta = Math.round(
          (constrainedDate.getTime() - normalizeToMidnight(originalDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // Update drag state for visual feedback
        currentDragStateRef = {
          ...currentDragStateRef,
          lastDaysDelta: constrainedDaysDelta
        };
        setDragState(currentDragStateRef);
        
        // Check for auto-scroll
        checkAutoScroll(e.clientX);
        
      } catch (error) {
        ErrorHandlingService.handle(error, { source: 'usePhaseResize', action: 'Error during phase resize drag' });
      }
    };
    
    const handleMouseUp = () => {
      const finalDaysDelta = currentDragStateRef.lastDaysDelta || 0;
      stopAutoScroll();
      
      // Only update if there was actual movement
      if (finalDaysDelta !== 0) {
        // Calculate final dates
  const updates: Partial<Phase> = {};
        
        if (action === 'resize-phase-start') {
          const newStartDate = addDaysToDate(new Date(currentDragStateRef.originalStartDate), finalDaysDelta);
          updates.startDate = newStartDate;
          // dueDate is not changed when moving start
        } else {
          const newEndDate = addDaysToDate(new Date(currentDragStateRef.originalEndDate), finalDaysDelta);
          updates.endDate = newEndDate;
          updates.dueDate = newEndDate; // Keep dueDate in sync with endDate
        }
        
        // Update database
        updatePhase(phaseId, updates, { silent: true })
          .then(() => {
            setIsDragging(false);
            setDragState(null);
            toast({
              title: "Success",
              description: `${targetPhase.name} dates updated successfully`,
            });
          })
          .catch((error: Error) => {
            ErrorHandlingService.handle(error, { source: 'usePhaseResize', action: 'Failed to update phase:' });
            setIsDragging(false);
            setDragState(null);
            toast({
              title: "Error",
              description: "Failed to update phase dates",
              variant: "destructive"
            });
          });
      } else {
        // No movement - clear drag state immediately
        setIsDragging(false);
        setDragState(null);
      }
      
      // Remove all event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
  }, [
    phases,
    timelineMode,
    updatePhase,
    checkAutoScroll,
    stopAutoScroll,
    setIsDragging,
    setDragState
  ]);
  
  return { handlePhaseResizeMouseDown };
}
