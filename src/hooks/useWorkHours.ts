import { useState, useEffect, useCallback } from 'react';
import { WorkHour, WorkSlot } from '../types/core';
import { useSettings } from './useSettings';

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

// Temporary in-memory storage for calendar-specific overrides
let weeklyOverrides: WorkHour[] = [];
let nextId = 1;

export const useWorkHours = (): UseWorkHoursReturn => {
  const { settings, updateSettings } = useSettings();
  const [workHours, setWorkHours] = useState<WorkHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScopeDialog, setShowScopeDialog] = useState(false);
  const [pendingWorkHourChange, setPendingWorkHourChange] = useState<PendingChange | null>(null);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());

  // Get the start date for any given week (Monday)
  const getWeekStart = useCallback((date: Date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const weekStart = new Date(date);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }, []);

  // Get the current week's start date (Monday)
  const getCurrentWeekStart = useCallback(() => {
    return getWeekStart(new Date());
  }, [getWeekStart]);

  // Convert settings work slots to calendar work hours for specified week
  const generateWorkHoursFromSettings = useCallback((weekStartDate: Date) => {
    if (!settings?.weekly_work_hours) return [];
    
    const workHours: WorkHour[] = [];
    
    // Correct day mapping: Monday = 0, Tuesday = 1, etc.
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    dayNames.forEach((dayName, dayIndex) => {
      const weeklyWorkHours = settings.weekly_work_hours as any;
      const daySlots = weeklyWorkHours[dayName as keyof typeof weeklyWorkHours] || [];
      
      daySlots.forEach((slot: WorkSlot) => {
        const workHourDate = new Date(weekStartDate);
        workHourDate.setDate(weekStartDate.getDate() + dayIndex); // Monday + 0 = Monday, etc.
        
        // Parse time strings
        const [startHour, startMin] = slot.startTime.split(':').map(Number);
        const [endHour, endMin] = slot.endTime.split(':').map(Number);
        
        const startDateTime = new Date(workHourDate);
        startDateTime.setHours(startHour, startMin, 0, 0);
        
        const endDateTime = new Date(workHourDate);
        endDateTime.setHours(endHour, endMin, 0, 0);
        
        workHours.push({
          id: `settings-${dayName}-${slot.id}-${weekStartDate.getTime()}`, // Include week to make unique
          title: `Work Hours`,
          description: `Default ${dayName} work hours`,
          startTime: startDateTime,
          endTime: endDateTime,
          duration: slot.duration,
          type: 'work'
        });
      });
    });
    
    return workHours;
  }, [settings?.weekly_work_hours]);

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
      
      if (isCurrentWeek) {
        // Apply overrides for current week
        const finalWorkHours: WorkHour[] = [];
        
        // First, add all settings work hours
        settingsWorkHours.forEach(settingsWH => {
          // Check if there's an override for this work hour
          const override = weeklyOverrides.find(override => 
            override.id === `override-${settingsWH.id}` || 
            override.id === settingsWH.id
          );
          
          if (override) {
            // Use the override instead of the settings work hour
            if (override.description !== 'DELETED_OVERRIDE') {
              finalWorkHours.push(override);
            }
            // If it's a deleted override, skip adding this work hour
          } else {
            // No override, use the settings work hour
            finalWorkHours.push(settingsWH);
          }
        });
        
        // Add custom work hours (not from settings) for current week only
        weeklyOverrides.forEach(override => {
          const isCustom = !override.id.startsWith('override-') && 
                          !override.id.startsWith('settings-') &&
                          override.description !== 'DELETED_OVERRIDE';
          if (isCustom) {
            finalWorkHours.push(override);
          }
        });
        
        finalWorkHours.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        setWorkHours(finalWorkHours);
      } else {
        // For non-current weeks, just show settings work hours (no overrides)
        settingsWorkHours.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        setWorkHours(settingsWorkHours);
      }
    } catch (err) {
      console.error('Error fetching work hours:', err);
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
        const newWorkHour: WorkHour = {
          id: `custom-${nextId++}`,
          title: workHourData.title,
          description: workHourData.description || '',
          startTime: new Date(workHourData.startTime),
          endTime: new Date(workHourData.endTime),
          duration: (new Date(workHourData.endTime).getTime() - new Date(workHourData.startTime).getTime()) / (1000 * 60 * 60),
          type: workHourData.type || 'work'
        };

        weeklyOverrides.push(newWorkHour);
        await fetchWorkHours();
        return newWorkHour;
      }
    } catch (err) {
      console.error('Error adding work hour:', err);
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
    
    console.log('updateWorkHour called:', { id, updates, scope, isFromSettings });
    
    if (!scope && isFromSettings) {
      // Show scope dialog for settings-based work hours
      console.log('Showing scope dialog for settings work hour');
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
        // Update settings permanently
        console.log('Updating settings permanently for work hour:', id);
        await updateSettingsWorkHour(id, updates);
      } else {
        // Update just this week (add/update override)
        if (isFromSettings) {
          // Create or update override for settings-based work hour
          const originalWorkHour = workHours.find(wh => wh.id === id);
          if (originalWorkHour) {
            const overrideId = `override-${id}`;
            const existingOverrideIndex = weeklyOverrides.findIndex(wh => wh.id === overrideId);
            
            const updatedWorkHour = {
              ...originalWorkHour,
              ...updates,
              id: overrideId
            };
            
            if (existingOverrideIndex !== -1) {
              weeklyOverrides[existingOverrideIndex] = updatedWorkHour;
            } else {
              weeklyOverrides.push(updatedWorkHour);
            }
          }
        } else {
          // Update custom work hour or existing override
          const existingIndex = weeklyOverrides.findIndex(wh => wh.id === id);
          if (existingIndex !== -1) {
            weeklyOverrides[existingIndex] = { 
              ...weeklyOverrides[existingIndex], 
              ...updates 
            };
          }
        }
      }
      
      await fetchWorkHours();
    } catch (err) {
      console.error('Error updating work hour:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update work hour';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteWorkHour = async (id: string, scope?: 'this-week' | 'permanent'): Promise<void> => {
    const isFromSettings = id.startsWith('settings-');
    
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
        if (isFromSettings) {
          // Add a "deleted" override (empty override that masks the settings entry)
          const originalWorkHour = workHours.find(wh => wh.id === id);
          if (originalWorkHour) {
            weeklyOverrides.push({
              id: `deleted-${id}`,
              title: '',
              startTime: originalWorkHour.startTime,
              endTime: originalWorkHour.endTime,
              duration: originalWorkHour.duration,
              description: 'DELETED_OVERRIDE'
            });
          }
        } else {
          // Remove from overrides
          weeklyOverrides = weeklyOverrides.filter(wh => wh.id !== id);
        }
      }
      
      await fetchWorkHours();
    } catch (err) {
      console.error('Error deleting work hour:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete work hour';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const updateSettingsWorkHour = async (id: string, updates: Partial<Omit<WorkHour, 'id'>>) => {
    try {
      // Extract day and slot ID from settings work hour ID (format: settings-dayName-slotId-weekTimestamp)
      const match = id.match(/^settings-(\w+)-([^-]+)-\d+$/);
      if (!match || !settings?.weekly_work_hours) {
        console.log('updateSettingsWorkHour failed - no match or no settings:', { id, match, hasSettings: !!settings?.weekly_work_hours });
        return;
      }
      
      const [, dayName, slotId] = match;
      const weeklyWorkHours = settings.weekly_work_hours as any;
      const daySlots = weeklyWorkHours[dayName as keyof typeof weeklyWorkHours] || [];
      
      console.log('Updating settings work hour:', { id, dayName, slotId, updates, daySlots });
      
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
          
          console.log('Updated slot:', result);
          return result;
        }
        return slot;
      });

      const newWeeklyWorkHours = {
        ...weeklyWorkHours,
        [dayName]: updatedSlots
      };
      
      console.log('Updating settings with:', { weekly_work_hours: newWeeklyWorkHours });

      const result = await updateSettings({
        weekly_work_hours: newWeeklyWorkHours
      });
      
      console.log('Settings update result:', result);
    } catch (error) {
      console.error('Error in updateSettingsWorkHour:', error);
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
    const weeklyWorkHours = settings?.weekly_work_hours as any || {};
    const currentDaySlots = weeklyWorkHours[dayName] || [];
    
    await updateSettings({
      weekly_work_hours: {
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
    const match = id.match(/^settings-(\w+)-([^-]+)-\d+$/);
    if (!match || !settings?.weekly_work_hours) return;
    
    const [, dayName, slotId] = match;
    const weeklyWorkHours = settings.weekly_work_hours as any;
    const daySlots = weeklyWorkHours[dayName as keyof typeof weeklyWorkHours] || [];
    
    const updatedSlots = daySlots.filter((slot: WorkSlot) => slot.id !== slotId);

    await updateSettings({
      weekly_work_hours: {
        ...weeklyWorkHours,
        [dayName]: updatedSlots
      }
    });
  };

  const confirmWorkHourChange = async (scope: 'this-week' | 'permanent') => {
    if (!pendingWorkHourChange) return;
    
    const { type, workHourId, updates, newWorkHour } = pendingWorkHourChange;
    
    console.log('confirmWorkHourChange called:', { scope, type, workHourId, updates, newWorkHour });
    
    if (type === 'add' && newWorkHour) {
      await addWorkHour(newWorkHour, scope);
    } else if (type === 'update' && workHourId) {
      await updateWorkHour(workHourId, updates!, scope);
    } else if (type === 'delete' && workHourId) {
      await deleteWorkHour(workHourId, scope);
    }
    
    setPendingWorkHourChange(null);
    setShowScopeDialog(false);
  };

  const cancelWorkHourChange = () => {
    setPendingWorkHourChange(null);
    setShowScopeDialog(false);
  };

  const revertToSettings = async () => {
    // Clear all overrides and refresh from settings
    weeklyOverrides = [];
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
