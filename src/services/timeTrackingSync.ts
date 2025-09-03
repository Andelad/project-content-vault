/**
 * Time Tracking State Synchronization Service
 * 
 * Handles cross-window synchronization of time tracking state via:
 * 1. Database persistence (settings table)
 * 2. localStorage for immediate local sync
 * 3. Browser storage events for cross-window communication
 */

import { supabase } from '@/integrations/supabase/client';

export interface SyncedTrackingState {
  isTracking: boolean;
  startTime?: string; // ISO timestamp
  eventId?: string | null;
  selectedProject?: any;
  searchQuery?: string;
  affectedEvents?: string[];
  lastUpdated?: string; // ISO timestamp
}

export class TimeTrackingSyncService {
  private static readonly STORAGE_KEY = 'timeTracking_globalState';
  private static listeners: ((state: SyncedTrackingState | null) => void)[] = [];

  /**
   * Initialize the service by setting up storage event listeners
   */
  static initialize(): void {
    if (typeof window === 'undefined') return;

    // Listen for storage changes from other windows
    window.addEventListener('storage', (event) => {
      if (event.key === this.STORAGE_KEY) {
        const newState = event.newValue ? JSON.parse(event.newValue) : null;
        this.notifyListeners(newState);
      }
    });
  }

  /**
   * Subscribe to tracking state changes
   */
  static subscribe(callback: (state: SyncedTrackingState | null) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private static notifyListeners(state: SyncedTrackingState | null): void {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in tracking state listener:', error);
      }
    });
  }

  /**
   * Load tracking state from database
   */
  static async loadFromDatabase(): Promise<SyncedTrackingState | null> {
    try {
      const { data: settings, error } = await supabase
        .from('settings')
        .select('time_tracking_state')
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found is ok
          console.error('Error loading tracking state from database:', error);
        }
        return null;
      }

      const trackingState = settings?.time_tracking_state;
      if (!trackingState || !trackingState.isTracking) {
        return null;
      }

      // Validate the state has required fields
      if (!trackingState.startTime || !trackingState.eventId) {
        return null;
      }

      return trackingState;
    } catch (error) {
      console.error('Failed to load tracking state from database:', error);
      return null;
    }
  }

  /**
   * Save tracking state to database and localStorage
   */
  static async saveState(state: SyncedTrackingState | null): Promise<void> {
    const stateToSave = state ? {
      ...state,
      lastUpdated: new Date().toISOString()
    } : null;

    try {
      // Save to database
      const { error } = await supabase
        .from('settings')
        .update({ 
          time_tracking_state: stateToSave 
        })
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) {
        console.error('Error saving tracking state to database:', error);
        throw error;
      }

      // Save to localStorage for immediate sync
      if (typeof window !== 'undefined') {
        if (stateToSave) {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stateToSave));
        } else {
          localStorage.removeItem(this.STORAGE_KEY);
        }
      }

      // Notify listeners
      this.notifyListeners(stateToSave);

    } catch (error) {
      console.error('Failed to save tracking state:', error);
      throw error;
    }
  }

  /**
   * Get current state from localStorage (for immediate access)
   */
  static getLocalState(): SyncedTrackingState | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error parsing local tracking state:', error);
      return null;
    }
  }

  /**
   * Start tracking with cross-window sync
   */
  static async startTracking(trackingData: {
    startTime: Date;
    eventId: string;
    selectedProject?: any;
    searchQuery?: string;
    affectedEvents?: string[];
  }): Promise<void> {
    const state: SyncedTrackingState = {
      isTracking: true,
      startTime: trackingData.startTime.toISOString(),
      eventId: trackingData.eventId,
      selectedProject: trackingData.selectedProject,
      searchQuery: trackingData.searchQuery,
      affectedEvents: trackingData.affectedEvents || []
    };

    await this.saveState(state);
  }

  /**
   * Stop tracking with cross-window sync
   */
  static async stopTracking(): Promise<void> {
    await this.saveState(null);
  }

  /**
   * Update tracking state (for live updates)
   */
  static async updateState(updates: Partial<SyncedTrackingState>): Promise<void> {
    const currentState = this.getLocalState();
    if (!currentState || !currentState.isTracking) {
      return;
    }

    const updatedState = {
      ...currentState,
      ...updates
    };

    await this.saveState(updatedState);
  }

  /**
   * Clear all tracking data (for cleanup)
   */
  static async clearAll(): Promise<void> {
    await this.saveState(null);
    
    // Also clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
}
