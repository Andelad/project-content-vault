import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Settings } from '@/types/core';
import { useSettings as useSettingsHook } from '@/hooks/useSettings';
import { UnifiedTimeTrackerService } from '@/services';
import { supabase } from '@/integrations/supabase/client';

// Individual work hour override for specific dates
export interface WorkHourOverride {
  date: string; // ISO date string (YYYY-MM-DD)
  dayName: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  slotIndex: number; // Index in the day's slots array
  startTime: string;
  endTime: string;
  duration: number;
}

interface SettingsContextType {
  // Settings
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
  setDefaultView: (defaultViewSetting: string) => void;
  
  // Work Hours
  workHours: any[];
  workHourOverrides: WorkHourOverride[];
  addWorkHourOverride: (override: WorkHourOverride) => void;
  removeWorkHourOverride: (date: string, dayName: string, slotIndex: number) => void;
  
  // Timeline entries (legacy - to be refactored)
  timelineEntries: any[];
  updateTimelineEntry: (entry: any) => void;
  
  // Time tracking state
  isTimeTracking: boolean;
  setIsTimeTracking: (isTracking: boolean) => void;
  currentTrackingEventId: string | null;
  setCurrentTrackingEventId: (eventId: string | null) => void;
  
  // Loading states
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Database hooks
  const { 
    settings: dbSettings, 
    loading: settingsLoading, 
    updateSettings: dbUpdateSettings 
  } = useSettingsHook();

  // Local state
  const [workHourOverrides, setWorkHourOverrides] = useState<WorkHourOverride[]>([]);
  const [workHours] = useState<any[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<any[]>([]);
  const [isTimeTracking, setIsTimeTracking] = useState<boolean>(false);
  const [currentTrackingEventId, setCurrentTrackingEventId] = useState<string | null>(null);
  const [realtimeSubscription, setRealtimeSubscription] = useState<any>(null);

  // Initialize sync service when user is available
  useEffect(() => {
    const initializeTracking = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.id) {
        UnifiedTimeTrackerService.setUserId(user.id);
        
        // Set up callback to sync state changes from other windows
        UnifiedTimeTrackerService.setOnStateChangeCallback(async (syncedState) => {
          setIsTimeTracking(syncedState.isTracking);
          setCurrentTrackingEventId(syncedState.eventId || null);
          
          // If tracking started, ensure UI state is synced by triggering a re-render
          // The TimeTracker components will react to the global state change
          if (syncedState.isTracking && syncedState.eventId) {
            // Force a small delay to ensure state propagation
            setTimeout(() => {
              // This will trigger the TimeTracker useEffect that reacts to global state
            }, 0);
          }
        });

        // Load initial state from database
        const dbState = await UnifiedTimeTrackerService.loadState();
        if (dbState) {
          // Only set tracking to true if we have COMPLETE state with all required fields
          // This prevents the flash of incomplete tracking state when opening a new window
          const hasCompleteState = dbState.isTracking && 
                                    dbState.eventId && 
                                    dbState.startTime && 
                                    dbState.selectedProject;
          
          if (hasCompleteState) {
            setIsTimeTracking(true);
            setCurrentTrackingEventId(dbState.eventId);
          } else if (dbState.isTracking) {
            // We have incomplete tracking state - clean it up
            console.warn('⚠️ Found incomplete tracking state in DB, cleaning up:', {
              hasEventId: !!dbState.eventId,
              hasStartTime: !!dbState.startTime,
              hasSelectedProject: !!dbState.selectedProject
            });
            // Clean up the incomplete state
            await UnifiedTimeTrackerService.stopTracking().catch(err => {
              console.error('Failed to clean up incomplete tracking state:', err);
            });
            setIsTimeTracking(false);
            setCurrentTrackingEventId(null);
          } else {
            // Tracking is off, ensure state is clean
            setIsTimeTracking(false);
            setCurrentTrackingEventId(null);
          }
        }

        // Set up real-time subscription
        const subscription = await UnifiedTimeTrackerService.setupRealtimeSubscription();
        setRealtimeSubscription(subscription);
      }
    };

    initializeTracking();

    return () => {
      if (realtimeSubscription) {
        realtimeSubscription.unsubscribe();
      }
    };
  }, []);

  // Update setIsTimeTracking - DO NOT sync to database here
  // The workflow handlers already save complete state to the database
  // This would overwrite with incomplete state
  const setIsTimeTrackingWithSync = useCallback(async (isTracking: boolean) => {
    setIsTimeTracking(isTracking);
    // No database sync here - workflows handle that with complete state
  }, []);

  // Default settings fallback if not loaded from database
  const defaultSettings: Settings = {
    weeklyWorkHours: {
      monday: [{ id: '1', startTime: '09:00', endTime: '17:00', duration: 8 }],
      tuesday: [{ id: '2', startTime: '09:00', endTime: '17:00', duration: 8 }],
      wednesday: [
        { id: '3a', startTime: '09:00', endTime: '13:00', duration: 4 },
        { id: '3b', startTime: '14:00', endTime: '18:00', duration: 4 }
      ],
      thursday: [{ id: '4', startTime: '09:00', endTime: '17:00', duration: 8 }],
      friday: [{ id: '5', startTime: '09:00', endTime: '17:00', duration: 8 }],
      saturday: [],
      sunday: []
    },
    defaultView: 'timeline'
  };

  // Temporary local storage for defaultView until database migration is applied
  const [localDefaultView, setLocalDefaultView] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('defaultView') || defaultSettings.defaultView;
    }
    return defaultSettings.defaultView;
  });

  const processedSettings: Settings = dbSettings ? {
    weeklyWorkHours: (typeof dbSettings.weekly_work_hours === 'object' && 
                     dbSettings.weekly_work_hours !== null && 
                     !Array.isArray(dbSettings.weekly_work_hours) &&
                     'monday' in dbSettings.weekly_work_hours) 
      ? dbSettings.weekly_work_hours as unknown as Settings['weeklyWorkHours']
      : defaultSettings.weeklyWorkHours,
    defaultView: localDefaultView // Use local storage value for now
  } : { ...defaultSettings, defaultView: localDefaultView };

  // Helper function to set view based on default view setting
  const setDefaultView = useCallback((defaultViewSetting: string) => {
    setLocalDefaultView(defaultViewSetting);
    if (typeof window !== 'undefined') {
      localStorage.setItem('defaultView', defaultViewSetting);
    }
  }, []);

  const addWorkHourOverride = useCallback((override: WorkHourOverride) => {
    setWorkHourOverrides(prev => [...prev, override]);
  }, []);

  const removeWorkHourOverride = useCallback((date: string, dayName: string, slotIndex: number) => {
    setWorkHourOverrides(prev => 
      prev.filter(override => 
        !(override.date === date && override.dayName === dayName && override.slotIndex === slotIndex)
      )
    );
  }, []);

  const updateTimelineEntry = useCallback((entry: any) => {
    setTimelineEntries(prev => {
      const index = prev.findIndex(e => e.id === entry.id);
      if (index >= 0) {
        const newEntries = [...prev];
        newEntries[index] = entry;
        return newEntries;
      } else {
        return [...prev, entry];
      }
    });
  }, []);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    // Transform frontend Settings to database format
    const dbUpdates: any = {};
    if (updates.weeklyWorkHours) {
      dbUpdates.weekly_work_hours = updates.weeklyWorkHours;
    }
    return dbUpdateSettings(dbUpdates);
  }, [dbUpdateSettings]);

  const contextValue: SettingsContextType = {
    // Settings
    settings: processedSettings,
    updateSettings,
    setDefaultView,
    
    // Work Hours
    workHours,
    workHourOverrides,
    addWorkHourOverride,
    removeWorkHourOverride,
    
    // Timeline entries (legacy)
    timelineEntries,
    updateTimelineEntry,
    
    // Time tracking state
    isTimeTracking,
    setIsTimeTracking: setIsTimeTrackingWithSync,
    currentTrackingEventId,
    setCurrentTrackingEventId,
    
    // Loading states
    isLoading: settingsLoading,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettingsContext must be used within a SettingsProvider');
  }
  return context;
}

// Export types
export type { Settings } from '@/types/core';
