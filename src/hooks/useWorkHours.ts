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

// Week-specific storage for calendar overrides
// Key is the week start timestamp, value is the overrides for that week
let weeklyOverridesMap: Map<number, WorkHour[]> = new Map();
let nextId = 1;

export const useWorkHours = (): UseWorkHoursReturn => {
  const { settings, updateSettings } = useSettings();
  const [workHours, setWorkHours] = useState<WorkHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showScopeDialog, setShowScopeDialog] = useState(false);
  const [pendingWorkHourChange, setPendingWorkHourChange] = useState<PendingChange | null>(null);
  const [currentViewDate, setCurrentViewDate] = useState(new Date());

  // Helper functions for week-specific overrides
  const getWeekOverrides = useCallback((weekStart: Date): WorkHour[] => {
    const weekKey = weekStart.getTime();
    const overrides = weeklyOverridesMap.get(weekKey) || [];
    console.log('getWeekOverrides:', { weekKey, count: overrides.length, overrides: overrides.map(o => o.id) });
    return overrides;
  }, []);

  const setWeekOverrides = useCallback((weekStart: Date, overrides: WorkHour[]) => {
    const weekKey = weekStart.getTime();
    console.log('setWeekOverrides:', { weekKey, count: overrides.length, overrides: overrides.map(o => o.id) });
    weeklyOverridesMap.set(weekKey, overrides);
  }, []);

  const addWeekOverride = useCallback((weekStart: Date, override: WorkHour) => {
    const currentOverrides = getWeekOverrides(weekStart);
    setWeekOverrides(weekStart, [...currentOverrides, override]);
  }, [getWeekOverrides, setWeekOverrides]);

  const updateWeekOverride = useCallback((weekStart: Date, overrideId: string, updatedOverride: WorkHour) => {
    const currentOverrides = getWeekOverrides(weekStart);
    const existingIndex = currentOverrides.findIndex(wh => wh.id === overrideId);
    
    if (existingIndex !== -1) {
      const newOverrides = [...currentOverrides];
      newOverrides[existingIndex] = updatedOverride;
      setWeekOverrides(weekStart, newOverrides);
    } else {
      addWeekOverride(weekStart, updatedOverride);
    }
  }, [getWeekOverrides, setWeekOverrides, addWeekOverride]);

  const removeWeekOverride = useCallback((weekStart: Date, overrideId: string) => {
    const currentOverrides = getWeekOverrides(weekStart);
    const newOverrides = currentOverrides.filter(wh => wh.id !== overrideId);
    setWeekOverrides(weekStart, newOverrides);
  }, [getWeekOverrides, setWeekOverrides]);

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
    const weekStart = getWeekStart(new Date());
    console.log('getCurrentWeekStart:', weekStart.toISOString());
    return weekStart;
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
      
      // Get overrides for the current week
      const weekOverrides = getWeekOverrides(currentWeekStart);
      
      console.log('fetchWorkHours:', { 
        viewWeekStart: viewWeekStart.toISOString(), 
        currentWeekStart: currentWeekStart.toISOString(),
        isCurrentWeek,
        settingsWorkHours: settingsWorkHours.length,
        weekOverrides: weekOverrides.length
      });
      
      if (isCurrentWeek) {
        // Apply overrides for current week
        const finalWorkHours: WorkHour[] = [];
        
        // First, add all settings work hours
        settingsWorkHours.forEach(settingsWH => {
          // Check if there's an override for this work hour
          const overrideId = `override-${settingsWH.id}`;
          const override = weekOverrides.find(override => 
            override.id === overrideId
          );
          
          console.log('Checking settings work hour:', { 
            settingsWHId: settingsWH.id, 
            overrideId, 
            foundOverride: !!override,
            overrideDetails: override 
          });
          
          if (override) {
            // Use the override instead of the settings work hour
            if (override.description !== 'DELETED_OVERRIDE') {
              console.log('Using override for:', settingsWH.id, '→', override.id);
              finalWorkHours.push(override);
            } else {
              console.log('Skipping deleted work hour:', settingsWH.id);
            }
            // If it's a deleted override, skip adding this work hour
          } else {
            // No override, use the settings work hour
            console.log('Using settings work hour:', settingsWH.id);
            finalWorkHours.push(settingsWH);
          }
        });
        
        // Add custom work hours (not from settings) for current week only
        weekOverrides.forEach(override => {
          const isCustom = !override.id.startsWith('override-') && 
                          !override.id.startsWith('settings-') &&
                          override.description !== 'DELETED_OVERRIDE';
          if (isCustom) {
            console.log('Adding custom work hour:', override.id);
            finalWorkHours.push(override);
          }
        });
        
        finalWorkHours.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
        setWorkHours(finalWorkHours);
      } else {
        // For non-current weeks, just show settings work hours (no overrides)
        console.log('Non-current week, showing all settings work hours:', settingsWorkHours.length);
        
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

        // Add to current week overrides
        const currentWeekStart = getCurrentWeekStart();
        addWeekOverride(currentWeekStart, newWorkHour);
        
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
    
    // Check if this is a past event that shouldn't be editable
    const workHour = workHours.find(wh => wh.id === id);
    if (workHour) {
      const now = new Date();
      const eventEnd = new Date(workHour.endTime);
      if (eventEnd < now) {
        setError('Cannot modify past work hours');
        return;
      }
    }
    
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
        // Update settings permanently - but only for future events
        console.log('Updating settings permanently for work hour:', id);
        await updateSettingsWorkHour(id, updates);
      } else {
        // Update just this week (add/update override)
        const currentWeekStart = getCurrentWeekStart();
        console.log('Updating for this week only:', { currentWeekStart: currentWeekStart.toISOString(), id, updates });
        
        if (isFromSettings) {
          // Create or update override for settings-based work hour
          const originalWorkHour = workHours.find(wh => wh.id === id);
          console.log('Found original work hour:', originalWorkHour);
          
          if (originalWorkHour) {
            const overrideId = `override-${id}`;
            
            const updatedWorkHour = {
              ...originalWorkHour,
              ...updates,
              id: overrideId,
              // Recalculate duration if start or end time changed
              duration: updates.startTime && updates.endTime 
                ? (new Date(updates.endTime).getTime() - new Date(updates.startTime).getTime()) / (1000 * 60 * 60)
                : originalWorkHour.duration
            };
            
            console.log('Creating/updating override:', { overrideId, updatedWorkHour });
            
            updateWeekOverride(currentWeekStart, overrideId, updatedWorkHour);
            console.log('Override added to map');
          } else {
            console.error('Original work hour not found for ID:', id);
          }
        } else {
          console.log('Updating custom work hour');
          // Update custom work hour or existing override
          const weekOverrides = getWeekOverrides(currentWeekStart);
          const existingIndex = weekOverrides.findIndex(wh => wh.id === id);
          
          if (existingIndex !== -1) {
            const updatedWorkHour = { 
              ...weekOverrides[existingIndex], 
              ...updates 
            };
            
            // Recalculate duration if start or end time changed
            if (updates.startTime && updates.endTime) {
              updatedWorkHour.duration = (new Date(updates.endTime).getTime() - new Date(updates.startTime).getTime()) / (1000 * 60 * 60);
            }
            
            updateWeekOverride(currentWeekStart, id, updatedWorkHour);
          }
        }
      }
      
      console.log('About to call fetchWorkHours after work hour update');
      await fetchWorkHours(new Date()); // Force refresh of current date/week
      console.log('fetchWorkHours completed after work hour update');
    } catch (err) {
      console.error('Error updating work hour:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update work hour';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteWorkHour = async (id: string, scope?: 'this-week' | 'permanent'): Promise<void> => {
    const isFromSettings = id.startsWith('settings-');
    
    // Check if this is a past event that shouldn't be editable
    const workHour = workHours.find(wh => wh.id === id);
    if (workHour) {
      const now = new Date();
      const eventEnd = new Date(workHour.endTime);
      if (eventEnd < now) {
        setError('Cannot delete past work hours');
        return;
      }
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
          // Add a "deleted" override (empty override that masks the settings entry)
          const originalWorkHour = workHours.find(wh => wh.id === id);
          if (originalWorkHour) {
            const deletedOverride = {
              id: `deleted-${id}`,
              title: '',
              startTime: originalWorkHour.startTime,
              endTime: originalWorkHour.endTime,
              duration: originalWorkHour.duration,
              description: 'DELETED_OVERRIDE'
            };
            addWeekOverride(currentWeekStart, deletedOverride);
          }
        } else {
          // Remove from overrides
          removeWeekOverride(currentWeekStart, id);
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
    console.log('Current weeklyOverridesMap:', Array.from(weeklyOverridesMap.entries()));
    
    try {
      if (type === 'add' && newWorkHour) {
        await addWorkHour(newWorkHour, scope);
      } else if (type === 'update' && workHourId) {
        await updateWorkHour(workHourId, updates!, scope);
      } else if (type === 'delete' && workHourId) {
        await deleteWorkHour(workHourId, scope);
      }
      
      console.log('After change, weeklyOverridesMap:', Array.from(weeklyOverridesMap.entries()));
    } catch (error) {
      console.error('Error in confirmWorkHourChange:', error);
    }
    
    setPendingWorkHourChange(null);
    setShowScopeDialog(false);
  };

  const cancelWorkHourChange = () => {
    setPendingWorkHourChange(null);
    setShowScopeDialog(false);
  };

  const revertToSettings = async () => {
    // Clear all overrides for current week and refresh from settings
    const currentWeekStart = getCurrentWeekStart();
    setWeekOverrides(currentWeekStart, []);
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
