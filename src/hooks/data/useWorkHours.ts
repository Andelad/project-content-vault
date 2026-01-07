import { useState, useEffect, useCallback, useMemo } from 'react';
import { WorkHour, WorkSlot, CalendarEvent, WorkHourException, Settings } from '@/types';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { WorkHourCalculationService } from '@/domain/rules/availability/WorkHourGeneration';
import {
  getWorkHourExceptions,
  updateWorkHourForDate,
  deleteWorkHourForDate,
  applyExceptionsToWorkHours
} from '@/services/data/workHours/workHourExceptions';
import { ErrorHandlingService } from '@/infrastructure/ErrorHandlingService';
import { WorkSlotOrchestrator, DayOfWeek } from '@/services/orchestrators/WorkSlotOrchestrator';

interface UseWorkHoursReturn {
  workHours: WorkHour[];
  exceptions: WorkHourException[];
  loading: boolean;
  error: string | null;
  addWorkHour: (workHour: Omit<WorkHour, 'id'>, scope?: 'this-day' | 'all-future') => Promise<WorkHour>;
  updateWorkHour: (id: string, updates: Partial<Omit<WorkHour, 'id'>>, scope?: 'this-day' | 'all-future') => Promise<void>;
  deleteWorkHour: (id: string, scope?: 'this-day' | 'all-future') => Promise<void>;
  refreshWorkHours: (currentDate?: Date) => Promise<void>;
  showScopeDialog: boolean;
  pendingWorkHourChange: PendingChange | null;
  confirmWorkHourChange: (scope: 'this-day' | 'all-future') => Promise<void>;
  cancelWorkHourChange: () => void;
  fetchWorkHours: (viewDate?: Date) => Promise<void>;
  getCurrentWeekStart: () => Date;
  revertToSettings: () => Promise<void>;
  currentViewDate: Date;
  setCurrentViewDate: (date: Date) => void;
}

interface PendingChange {
  type: 'update' | 'delete' | 'add';
  workHourId?: string;
  updates?: Partial<Omit<WorkHour, 'id'>>;
  newWorkHour?: Omit<WorkHour, 'id'>;
  isFromSettings: boolean;
}

// TODO Phase 2: Implement work slot exceptions using work_slot_exceptions table
// Current exception handling (weekOverrideManager) is broken and has been removed
// Will be reimplemented using WorkSlotOrchestrator.createException() etc.

export const useWorkHours = (): UseWorkHoursReturn => {
  const { settings, updateSettings } = useSettingsContext();
  const [workHours, setWorkHours] = useState<WorkHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScopeDialog, setShowScopeDialog] = useState(false);
  const [pendingWorkHourChange, setPendingWorkHourChange] = useState<PendingChange | null>(null);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());
  const [exceptions, setExceptions] = useState<WorkHourException[]>([]);

  // TODO Phase 2: Restore week override functionality using work_slot_exceptions table
  // Previous implementation (weekOverrideManager) was broken and has been removed

  // Get the start date for any given week (Monday)
  const getWeekStart = useCallback((date: Date) => {
    const weekStart = WorkHourCalculationService.getWeekStart(date);
    return weekStart;
  }, []);

  // Get the current week's start date (Monday)
  const getCurrentWeekStart = useCallback(() => {
    const weekStart = WorkHourCalculationService.getCurrentWeekStart();
    return weekStart;
  }, []);

  // Convert settings work slots to calendar work hours for specified week
  const generateWorkHoursFromSettings = useCallback((weekStartDate: Date) => {
    if (!settings?.weeklyWorkHours) return [];
    
    return WorkHourCalculationService.generateWorkHoursFromSettings({
      weekStartDate,
      weeklyWorkHours: settings.weeklyWorkHours
    });
  }, [settings?.weeklyWorkHours]);

  const fetchWorkHours = useCallback(async (viewDate?: Date) => {
    try {
      setError(null);
      
      const dateToUse = viewDate || currentViewDate;
      
      // Generate work hours from settings as RRULE-based recurring events
      // This creates one master event per work slot that repeats infinitely
      const viewWeekStart = getWeekStart(dateToUse);
      const baseWorkHours = generateWorkHoursFromSettings(viewWeekStart);
      
      // Fetch exceptions from database
      // We fetch a wider range to handle visible exceptions
      // (FullCalendar will only render what's visible anyway)
      const fetchStart = new Date(viewWeekStart);
      fetchStart.setMonth(fetchStart.getMonth() - 1); // 1 month before
      const fetchEnd = new Date(viewWeekStart);
      fetchEnd.setMonth(fetchEnd.getMonth() + 3); // 3 months after
      
      const exceptionsResult = await getWorkHourExceptions(
        fetchStart,
        fetchEnd
      );
      
      if (exceptionsResult.success && exceptionsResult.exceptions) {
        setExceptions(exceptionsResult.exceptions);
        
        // TODO Phase 2: Convert exceptions to override work hours
        // Previous implementation below is broken - will be reimplemented
        
        // Modified exceptions: create single-instance work hour with new times
        const exceptionWorkHours: WorkHour[] = [];
        
        exceptionsResult.exceptions.forEach(exception => {
          const exceptionDate = new Date(exception.exceptionDate);
          
          if (exception.exceptionType === 'modified' && exception.modifiedStartTime && exception.modifiedEndTime) {
            // Create a single-instance work hour for the modified time
            const [startHour, startMin] = exception.modifiedStartTime.split(':').map(Number);
            const [endHour, endMin] = exception.modifiedEndTime.split(':').map(Number);
            
            const startTime = new Date(exceptionDate);
            startTime.setHours(startHour, startMin, 0, 0);
            const endTime = new Date(exceptionDate);
            endTime.setHours(endHour, endMin, 0, 0);
            
            exceptionWorkHours.push({
              id: `exception-${exception.id}`,
              title: 'Work Hours (Modified)',
              description: 'Modified work hours for this day',
              startTime,
              endTime,
              duration: (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60),
              type: 'work',
              dayOfWeek: exception.dayOfWeek,
              slotId: exception.slotId,
              isException: true
              // No rrule - this is a single instance
            });
          }
          // For deleted exceptions, we'll filter them out in the transform layer
          // by checking if an exception exists for that date/slot
        });
        
        // Combine base RRULE work hours with exception overlays
        const allWorkHours = [...baseWorkHours, ...exceptionWorkHours];
        allWorkHours.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        setWorkHours(allWorkHours);
      } else {
        // No exceptions, just use base RRULE work hours
        setWorkHours(baseWorkHours);
      }
    } catch (err) {
      ErrorHandlingService.handle(err, { source: 'useWorkHours', action: 'Error fetching work hours:' });
      setError(err instanceof Error ? err.message : 'Failed to fetch work hours');
      setWorkHours([]);
    } finally {
      setLoading(false);
    }
  }, [currentViewDate, generateWorkHoursFromSettings, getWeekStart]);

  const addWorkHour = async (
    workHourData: Omit<WorkHour, 'id'>, 
    scope?: 'this-day' | 'all-future'
  ): Promise<WorkHour> => {
    // Always show scope dialog for new work hours unless scope is specified
    if (!scope) {
      setPendingWorkHourChange({
        type: 'add',
        newWorkHour: workHourData,
        isFromSettings: false
      });
      setShowScopeDialog(true);
      return Promise.resolve({} as WorkHour); // Will be resolved after scope selection
    }

    try {
      setError(null);
      
      if (scope === 'all-future') {
        // Add to settings permanently (all future days)
        return await addToSettingsPermanently(workHourData);
      } else {
        // Add just for this specific day - this is less common for work hours
        // but we could create an exception for it if needed
        return await addToSettingsPermanently(workHourData);
      }
    } catch (err) {
      ErrorHandlingService.handle(err, { source: 'useWorkHours', action: 'Error adding work hour:' });
      const errorMessage = err instanceof Error ? err.message : 'Failed to add work hour';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const updateWorkHour = async (
    id: string, 
    updates: Partial<Omit<WorkHour, 'id'>>, 
    scope?: 'this-day' | 'all-future'
  ): Promise<void> => {
    const isFromSettings = id.startsWith('settings-');
    
    // Check if this is a past event that shouldn't be editable using service
    const workHour = workHours.find(wh => wh.id === id);
    if (workHour && !WorkHourCalculationService.canModifyWorkHour(workHour)) {
      setError('Cannot modify past work hours');
      return;
    }
    
    if (!scope && isFromSettings) {
      // Show scope dialog for settings-based work hours
      setPendingWorkHourChange({
        type: 'update',
        workHourId: id,
        updates,
        isFromSettings
      });
      setShowScopeDialog(true);
      return;
    }

    try {
      setError(null);
      
      if (scope === 'all-future' && isFromSettings) {
        // Update settings permanently - affects all future occurrences
        await updateSettingsWorkHour(id, updates);
      } else if (scope === 'this-day' && isFromSettings) {
        // Create an exception for this specific day
        const originalWorkHour = workHours.find(wh => wh.id === id);
        
        if (originalWorkHour && originalWorkHour.dayOfWeek && originalWorkHour.slotId) {
          // Extract new times from updates
          const newStartTime = updates.startTime ? new Date(updates.startTime) : originalWorkHour.startTime;
          const newEndTime = updates.endTime ? new Date(updates.endTime) : originalWorkHour.endTime;
          
          const startTimeStr = `${newStartTime.getHours().toString().padStart(2, '0')}:${newStartTime.getMinutes().toString().padStart(2, '0')}`;
          const endTimeStr = `${newEndTime.getHours().toString().padStart(2, '0')}:${newEndTime.getMinutes().toString().padStart(2, '0')}`;
          
          await updateWorkHourForDate(
            originalWorkHour.startTime,
            originalWorkHour.dayOfWeek,
            originalWorkHour.slotId,
            startTimeStr,
            endTimeStr
          );
        } else {
          ErrorHandlingService.handle(id, { source: 'useWorkHours', action: 'Original work hour not found for ID:' });
        }
      }
      
      await fetchWorkHours(new Date()); // Force refresh of current date/week
    } catch (err) {
      ErrorHandlingService.handle(err, { source: 'useWorkHours', action: 'Error updating work hour:' });
      const errorMessage = err instanceof Error ? err.message : 'Failed to update work hour';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteWorkHour = async (id: string, scope?: 'this-day' | 'all-future'): Promise<void> => {
    const isFromSettings = id.startsWith('settings-');
    
    // Check if this is a past event that shouldn't be editable using service
    const workHour = workHours.find(wh => wh.id === id);
    if (workHour && !WorkHourCalculationService.canModifyWorkHour(workHour)) {
      setError('Cannot delete past work hours');
      return;
    }
    
    if (!scope && isFromSettings) {
      // Show scope dialog for settings-based work hours
      setPendingWorkHourChange({
        type: 'delete',
        workHourId: id,
        isFromSettings
      });
      setShowScopeDialog(true);
      return;
    }

    try {
      setError(null);
      
      if (scope === 'all-future' && isFromSettings) {
        // Delete from settings permanently (all future occurrences)
        await deleteSettingsWorkHour(id);
      } else if (scope === 'this-day' && isFromSettings) {
        // Create a deletion exception for this specific day
        const originalWorkHour = workHours.find(wh => wh.id === id);
        
        if (originalWorkHour && originalWorkHour.dayOfWeek && originalWorkHour.slotId) {
          await deleteWorkHourForDate(
            originalWorkHour.startTime,
            originalWorkHour.dayOfWeek,
            originalWorkHour.slotId
          );
        }
      }
      
      await fetchWorkHours();
    } catch (err) {
      ErrorHandlingService.handle(err, { source: 'useWorkHours', action: 'Error deleting work hour:' });
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete work hour';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  /**
   * Update a template work slot (settings-based)
   * Uses WorkSlotOrchestrator for entity validation
   */
  const updateSettingsWorkHour = async (id: string, updates: Partial<Omit<WorkHour, 'id'>>) => {
    try {
      // Extract day and slot ID from settings work hour ID (format: settings-dayName-slotId)
      const match = id.match(/^settings-(\w+)-([^-]+)$/);
      if (!match || !settings?.weeklyWorkHours) {
        return;
      }
      
      const [, dayName, slotId] = match;
      
      // Convert WorkHour times (Date strings) to HH:MM format
      const startTime = updates.startTime 
        ? (() => {
            const d = new Date(updates.startTime);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          })()
        : undefined;
        
      const endTime = updates.endTime
        ? (() => {
            const d = new Date(updates.endTime);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          })()
        : undefined;

      // Use orchestrator for validation and update
      const result = await WorkSlotOrchestrator.updateTemplateSlot(
        {
          dayOfWeek: dayName as DayOfWeek,
          slotId,
          startTime,
          endTime
        },
        async (updates) => { await updateSettings(updates); },
        settings
      );

      if (!result.success) {
        throw new Error(result.error || result.errors?.join(', ') || 'Failed to update work slot');
      }
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useWorkHours', action: 'Error in updateSettingsWorkHour:' });
      throw error;
    }
  };

  /**
   * Add a new template work slot (settings-based)
   * Uses WorkSlotOrchestrator for entity validation
   */
  const addToSettingsPermanently = async (workHourData: Omit<WorkHour, 'id'>): Promise<WorkHour> => {
    // Determine which day this work hour is for
    const startDate = new Date(workHourData.startTime);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[startDate.getDay()] as DayOfWeek;
    
    // Convert WorkHour times (Date strings) to HH:MM format
    const startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
    const endDate = new Date(workHourData.endTime);
    const endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

    // Use orchestrator for validation and save
    const result = await WorkSlotOrchestrator.saveTemplateSlot(
      { dayOfWeek: dayName, startTime, endTime },
      async (updates) => { await updateSettings(updates); },
      settings
    );

    if (!result.success) {
      throw new Error(result.error || result.errors?.join(', ') || 'Failed to add work slot');
    }

    const newSlot = result.slot!;

    // Return the new work hour (formatted for calendar display)
    return {
      id: `settings-${dayName}-${newSlot.id}`,
      title: workHourData.title,
      description: workHourData.description || '',
      startTime: workHourData.startTime,
      endTime: workHourData.endTime,
      duration: newSlot.duration,
      type: workHourData.type || 'work'
    };
  };

  /**
   * Delete a template work slot (settings-based)
   * Uses WorkSlotOrchestrator
   */
  const deleteSettingsWorkHour = async (id: string) => {
    const match = id.match(/^settings-(\w+)-([^-]+)$/);
    if (!match || !settings?.weeklyWorkHours) return;
    
    const [, dayName, slotId] = match;

    const result = await WorkSlotOrchestrator.deleteTemplateSlot(
      {
        dayOfWeek: dayName as DayOfWeek,
        slotId
      },
      async (updates) => { await updateSettings(updates); },
      settings
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete work slot');
    }
  };

  const confirmWorkHourChange = async (scope: 'this-day' | 'all-future') => {
    if (!pendingWorkHourChange) return;
    
    const { type, workHourId, updates, newWorkHour } = pendingWorkHourChange;
    
    try {
      if (type === 'add' && newWorkHour) {
        await addWorkHour(newWorkHour, scope);
      } else if (type === 'update' && workHourId) {
        await updateWorkHour(workHourId, updates!, scope);
      } else if (type === 'delete' && workHourId) {
        await deleteWorkHour(workHourId, scope);
      }
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useWorkHours', action: 'Error in confirmWorkHourChange:' });
    }
    
    setPendingWorkHourChange(null);
    setShowScopeDialog(false);
  };

  const cancelWorkHourChange = () => {
    setPendingWorkHourChange(null);
    setShowScopeDialog(false);
  };

  const revertToSettings = async () => {
    // TODO Phase 2: Clear all exceptions for current week when implemented
    // For now, just refresh to show template slots
    await fetchWorkHours();
  };

  const refreshWorkHours = async (currentDate?: Date): Promise<void> => {
    setLoading(true);
    await fetchWorkHours(currentDate);
  };

  useEffect(() => {
    if (settings) {
      fetchWorkHours(currentViewDate);
    }
  }, [settings, generateWorkHoursFromSettings, currentViewDate, fetchWorkHours]);

  return {
    workHours,
    exceptions,
    loading,
    error,
    addWorkHour,
    updateWorkHour,
    deleteWorkHour,
    refreshWorkHours,
    showScopeDialog,
    pendingWorkHourChange,
    confirmWorkHourChange,
    cancelWorkHourChange,
    fetchWorkHours,
    getCurrentWeekStart,
    revertToSettings,
    currentViewDate,
    setCurrentViewDate,
  };
};
