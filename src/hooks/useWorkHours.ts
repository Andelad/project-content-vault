import { useState, useEffect, useCallback, useMemo } from 'react';
import { WorkHour, WorkSlot, CalendarEvent } from '@/types';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { WorkHourCalculationService } from '@/services/calculations/availability/workHourCalculations';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

interface UseWorkHoursReturn {
  workHours: WorkHour[];
  loading: boolean;
  error: string | null;
  addWorkHour: (workHour: Omit<WorkHour, 'id'>, scope?: 'this-week' | 'permanent') => Promise<WorkHour>;
  updateWorkHour: (id: string, updates: Partial<Omit<WorkHour, 'id'>>, scope?: 'this-week' | 'permanent') => Promise<void>;
  deleteWorkHour: (id: string, scope?: 'this-week' | 'permanent') => Promise<void>;
  refreshWorkHours: (currentDate?: Date) => Promise<void>;
  showScopeDialog: boolean;
  pendingWorkHourChange: PendingChange | null;
  confirmWorkHourChange: (scope: 'this-week' | 'permanent') => Promise<void>;
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

// Week-specific storage for calendar overrides - now managed by service
const weekOverrideManager = WorkHourCalculationService.createWeekOverrideManager();

export const useWorkHours = (): UseWorkHoursReturn => {
  const { settings, updateSettings } = useSettingsContext();
  const [workHours, setWorkHours] = useState<WorkHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScopeDialog, setShowScopeDialog] = useState(false);
  const [pendingWorkHourChange, setPendingWorkHourChange] = useState<PendingChange | null>(null);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());

  // Helper functions now delegate to service
  const getWeekOverrides = useCallback((weekStart: Date): WorkHour[] => {
    const overrides = weekOverrideManager.getWeekOverrides(weekStart);
    return overrides;
  }, []);

  const setWeekOverrides = useCallback((weekStart: Date, overrides: WorkHour[]) => { 
    weekOverrideManager.setWeekOverrides(weekStart, overrides);
  }, []);

  const addWeekOverride = useCallback((weekStart: Date, override: WorkHour) => {
    weekOverrideManager.addWeekOverride(weekStart, override);
  }, []);

  const updateWeekOverride = useCallback((weekStart: Date, overrideId: string, updatedOverride: WorkHour) => {
    weekOverrideManager.updateWeekOverride(weekStart, overrideId, updatedOverride);
  }, []);

  const removeWeekOverride = useCallback((weekStart: Date, overrideId: string) => {
    weekOverrideManager.removeWeekOverride(weekStart, overrideId);
  }, []);

  // Get the start date for any given week (Monday) - now uses service
  const getWeekStart = useCallback((date: Date) => {
    const weekStart = WorkHourCalculationService.getWeekStart(date);
    return weekStart;
  }, []);

  // Get the current week's start date (Monday) - now uses service
  const getCurrentWeekStart = useCallback(() => {
    const weekStart = WorkHourCalculationService.getCurrentWeekStart();
    return weekStart;
  }, []);

  // Convert settings work slots to calendar work hours for specified week - now uses service
  const generateWorkHoursFromSettings = useCallback((weekStartDate: Date) => {
    if (!settings?.weeklyWorkHours) return [];
    
    return WorkHourCalculationService.generateWorkHoursFromSettings({
      weekStartDate,
      weeklyWorkHours: settings.weeklyWorkHours
    });
  }, [settings?.weeklyWorkHours]);

  const fetchWorkHours = async (viewDate?: Date) => {
    try {
      setError(null);
      
      const dateToUse = viewDate || currentViewDate;
      
      // Generate work hours from settings for the current view week
      const viewWeekStart = getWeekStart(dateToUse);
      
      // For week view, generate work hours for the visible week
      // For month view, we might want to generate for multiple weeks, but let's start with current week
      const settingsWorkHours = generateWorkHoursFromSettings(viewWeekStart);
      
      // Only apply overrides for the current week (overrides are week-specific)
      const currentWeekStart = getCurrentWeekStart();
      const isCurrentWeek = viewWeekStart.getTime() === currentWeekStart.getTime();
      
      // Get overrides for the current week
      const weekOverrides = getWeekOverrides(currentWeekStart);
      
      // Use service to merge settings with overrides
      const finalWorkHours = WorkHourCalculationService.mergeWorkHoursWithOverrides({
        settingsWorkHours,
        weekOverrides,
        currentWeekStart,
        viewWeekStart
      });
      
      // Sort by start time
      finalWorkHours.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      setWorkHours(finalWorkHours);
    } catch (err) {
      ErrorHandlingService.handle(err, { source: 'useWorkHours', action: 'Error fetching work hours:' });
      setError(err instanceof Error ? err.message : 'Failed to fetch work hours');
      setWorkHours([]);
    } finally {
      setLoading(false);
    }
  };

  const addWorkHour = async (
    workHourData: Omit<WorkHour, 'id'>, 
    scope?: 'this-week' | 'permanent'
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
      
      if (scope === 'permanent') {
        // Add to settings permanently
        return await addToSettingsPermanently(workHourData);
      } else {
        // Add just for this week
        const newWorkHour = WorkHourCalculationService.createWorkHour(workHourData, 'custom');

        // Add to current week overrides
        const currentWeekStart = getCurrentWeekStart();
        addWeekOverride(currentWeekStart, newWorkHour);
        
        await fetchWorkHours();
        return newWorkHour;
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
    scope?: 'this-week' | 'permanent'
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
      
      if (scope === 'permanent' && isFromSettings) {
        // Update settings permanently - but only for future events
        await updateSettingsWorkHour(id, updates);
      } else {
        // Update just this week (add/update override)
        const currentWeekStart = getCurrentWeekStart();
        
        if (isFromSettings) {
          // Create or update override for settings-based work hour
          const originalWorkHour = workHours.find(wh => wh.id === id);
          
          if (originalWorkHour) {
            const overrideWorkHour = WorkHourCalculationService.createUpdateOverride(
              id,
              originalWorkHour,
              updates
            );
            
            updateWeekOverride(currentWeekStart, overrideWorkHour.id, overrideWorkHour);
          } else {
            ErrorHandlingService.handle(id, { source: 'useWorkHours', action: 'Original work hour not found for ID:' });
          }
        } else {
          // Update custom work hour or existing override
          const weekOverrides = getWeekOverrides(currentWeekStart);
          const existingWorkHour = weekOverrides.find(wh => wh.id === id);
          
          if (existingWorkHour) {
            const updatedWorkHour = WorkHourCalculationService.updateWorkHourWithDuration(
              existingWorkHour,
              updates
            );
            
            updateWeekOverride(currentWeekStart, id, updatedWorkHour);
          }
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

  const deleteWorkHour = async (id: string, scope?: 'this-week' | 'permanent'): Promise<void> => {
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
      
      if (scope === 'permanent' && isFromSettings) {
        // Delete from settings permanently
        await deleteSettingsWorkHour(id);
      } else {
        // Delete just this week
        const currentWeekStart = getCurrentWeekStart();
        
        if (isFromSettings) {
          // Create a deletion override using the service
          const deletionOverride = WorkHourCalculationService.createDeletionOverride(id);
          addWeekOverride(currentWeekStart, deletionOverride);
        } else {
          // Remove from overrides
          removeWeekOverride(currentWeekStart, id);
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

  const updateSettingsWorkHour = async (id: string, updates: Partial<Omit<WorkHour, 'id'>>) => {
    try {
      // Extract day and slot ID from settings work hour ID (format: settings-dayName-slotId)
      const match = id.match(/^settings-(\w+)-([^-]+)$/);
      if (!match || !settings?.weeklyWorkHours) {
        return;
      }
      
      const [, dayName, slotId] = match;
      const weeklyWorkHours = settings.weeklyWorkHours as any;
      const daySlots = weeklyWorkHours[dayName as keyof typeof weeklyWorkHours] || [];
      
      const updatedSlots = daySlots.map((slot: WorkSlot) => {
        if (slot.id === slotId) {
          const result = { ...slot };
          
          if (updates.startTime) {
            const startDate = new Date(updates.startTime);
            result.startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
          }
          
          if (updates.endTime) {
            const endDate = new Date(updates.endTime);
            result.endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
          }
          
          // Recalculate duration
          const [startHour, startMin] = result.startTime.split(':').map(Number);
          const [endHour, endMin] = result.endTime.split(':').map(Number);
          result.duration = (endHour + endMin / 60) - (startHour + startMin / 60);
          
          return result;
        }
        return slot;
      });

      const newWeeklyWorkHours = {
        ...weeklyWorkHours,
        [dayName]: updatedSlots
      };

      const result = await updateSettings({
        weeklyWorkHours: newWeeklyWorkHours
      });
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'useWorkHours', action: 'Error in updateSettingsWorkHour:' });
      throw error;
    }
  };

  const addToSettingsPermanently = async (workHourData: Omit<WorkHour, 'id'>): Promise<WorkHour> => {
    // Determine which day this work hour is for
    const startDate = new Date(workHourData.startTime);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[startDate.getDay()];
    
    // Create a new work slot
    const newSlot: WorkSlot = {
      id: Date.now().toString(),
      startTime: `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`,
      endTime: (() => {
        const endDate = new Date(workHourData.endTime);
        return `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
      })(),
      duration: (new Date(workHourData.endTime).getTime() - new Date(workHourData.startTime).getTime()) / (1000 * 60 * 60)
    };

    // Update settings
    const weeklyWorkHours = settings?.weeklyWorkHours as any || {};
    const currentDaySlots = weeklyWorkHours[dayName] || [];
    
    await updateSettings({
      weeklyWorkHours: {
        ...weeklyWorkHours,
        [dayName]: [...currentDaySlots, newSlot]
      }
    });

    // Return the new work hour (it will be regenerated from settings)
    return {
      id: `settings-${dayName}-${newSlot.id}`,
      title: workHourData.title,
      description: workHourData.description || '',
      startTime: workHourData.startTime,
      endTime: workHourData.endTime,
      duration: workHourData.duration || newSlot.duration,
      type: workHourData.type || 'work'
    };
  };

  const deleteSettingsWorkHour = async (id: string) => {
    const match = id.match(/^settings-(\w+)-([^-]+)$/);
    if (!match || !settings?.weeklyWorkHours) return;
    
    const [, dayName, slotId] = match;
    const weeklyWorkHours = settings.weeklyWorkHours as any;
    const daySlots = weeklyWorkHours[dayName as keyof typeof weeklyWorkHours] || [];
    
    const updatedSlots = daySlots.filter((slot: WorkSlot) => slot.id !== slotId);

    await updateSettings({
      weeklyWorkHours: {
        ...weeklyWorkHours,
        [dayName]: updatedSlots
      }
    });
  };

  const confirmWorkHourChange = async (scope: 'this-week' | 'permanent') => {
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
    // Clear all overrides for current week and refresh from settings using service
    const currentWeekStart = getCurrentWeekStart();
    weekOverrideManager.clearWeekOverrides(currentWeekStart);
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
  }, [settings, generateWorkHoursFromSettings, currentViewDate]);

  return {
    workHours,
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
