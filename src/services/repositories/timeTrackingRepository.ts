import { supabase } from '../../integrations/supabase/client';
import type { TimeTrackingState, SerializedTimeTrackingState } from '../../types/timeTracking';
/**
 * Time Tracking Repository
 * 
 * Handles all database operations for time tracking state.
 * Manages localStorage caching and Supabase realtime subscriptions.
 */
class TimeTrackingRepository {
  private userId: string | null = null;
  private readonly STORAGE_KEY = 'timeTracker_crossWindowSync';
  private readonly BACKUP_STORAGE_KEY = 'timeTracker_backup';
  setUserId(userId: string): void {
    this.userId = userId;
  }
  private serializeState(state: TimeTrackingState): SerializedTimeTrackingState {
    return {
      isTracking: state.isTracking,
      isPaused: state.isPaused ?? false,
      projectId: state.projectId ?? null,
      startTime: state.startTime?.toISOString() || null,
      pausedAt: state.pausedAt?.toISOString() || null,
      totalPausedDuration: state.totalPausedDuration ?? 0,
      lastUpdateTime: (state.lastUpdateTime || state.lastUpdated)?.toISOString() || null,
      // UI state for persistence across views
      eventId: state.eventId ?? null,
      selectedProject: state.selectedProject ?? null,
      searchQuery: state.searchQuery ?? '',
      affectedEvents: state.affectedEvents ?? [],
      currentSeconds: state.currentSeconds ?? 0
    };
  }
  private deserializeState(serializedState: SerializedTimeTrackingState): TimeTrackingState {
    return {
      isTracking: serializedState.isTracking,
      isPaused: serializedState.isPaused,
      projectId: serializedState.projectId,
      startTime: serializedState.startTime ? new Date(serializedState.startTime) : null,
      pausedAt: serializedState.pausedAt ? new Date(serializedState.pausedAt) : null,
      totalPausedDuration: serializedState.totalPausedDuration,
      lastUpdateTime: serializedState.lastUpdateTime ? new Date(serializedState.lastUpdateTime) : null,
      // UI state for persistence across views
      eventId: serializedState.eventId ?? null,
      selectedProject: serializedState.selectedProject ?? null,
      searchQuery: serializedState.searchQuery ?? '',
      affectedEvents: serializedState.affectedEvents ?? [],
      currentSeconds: serializedState.currentSeconds ?? 0,
      // Initialize legacy fields
      lastUpdated: serializedState.lastUpdateTime ? new Date(serializedState.lastUpdateTime) : undefined
    };
  }
  async saveState(state: TimeTrackingState): Promise<void> {
    if (!this.userId) {
      throw new Error('User ID must be set before saving state');
    }
    
    const serializedState = this.serializeState(state);
    
    try {
      // Try to save to database first
      const { error } = await supabase
        .from('settings')
        .upsert({
          user_id: this.userId,
          time_tracking_state: serializedState as any
        }, {
          onConflict: 'user_id'
        });
      
      if (error) {
        console.warn('⚠️ DB save failed, using localStorage fallback:', error);
        // DB failed, still save to localStorage as backup
        this.saveToLocalStorage(serializedState);
        throw error;
      }
      
      // DB save succeeded - also save to localStorage as write-through cache
      this.saveToLocalStorage(serializedState);
      console.log('✅ State saved to both DB and localStorage');
      
    } catch (error) {
      console.error('❌ Failed to save time tracking state:', error);
      throw error;
    }
  }
  async loadState(): Promise<TimeTrackingState | null> {
    if (!this.userId) {
      console.warn('⚠️ No user ID - cannot load state');
      return null;
    }
    
    let state: TimeTrackingState | null = null;
    
    try {
      // Try to load from Supabase first (primary source)
      const { data, error } = await supabase
        .from('settings')
        .select('time_tracking_state')
        .eq('user_id', this.userId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.warn('⚠️ DB load failed, trying localStorage fallback:', error);
        // DB failed, try localStorage fallback
        state = this.loadFromLocalStorage();
      } else if (data?.time_tracking_state) {
        const stateData = data.time_tracking_state as any;
        
        // Check if it's already a full state object or just serialized
        if (stateData.eventId !== undefined || stateData.selectedProject !== undefined) {
          state = {
            isTracking: stateData.isTracking,
            isPaused: stateData.isPaused ?? false,
            projectId: stateData.projectId ?? null,
            startTime: stateData.startTime ? new Date(stateData.startTime) : null,
            pausedAt: stateData.pausedAt ? new Date(stateData.pausedAt) : null,
            totalPausedDuration: stateData.totalPausedDuration ?? 0,
            lastUpdateTime: stateData.lastUpdateTime ? new Date(stateData.lastUpdateTime) : null,
            eventId: stateData.eventId ?? null,
            selectedProject: stateData.selectedProject ?? null,
            searchQuery: stateData.searchQuery ?? '',
            affectedEvents: stateData.affectedEvents ?? [],
            currentSeconds: stateData.currentSeconds ?? 0,
            lastUpdated: stateData.lastUpdateTime ? new Date(stateData.lastUpdateTime) : undefined
          };
        } else {
          state = this.deserializeState(stateData as SerializedTimeTrackingState);
        }
        
        // Clear localStorage cache since DB has the data
        this.clearBackupStorage();
        console.log('✅ Loaded state from DB, cleared localStorage cache');
      } else {
        // No data in DB, try localStorage fallback
        console.log('ℹ️ No state in DB, trying localStorage fallback');
        state = this.loadFromLocalStorage();
      }
      
    } catch (error) {
      console.error('❌ Error loading state from DB, trying localStorage:', error);
      state = this.loadFromLocalStorage();
    }
    
    // Validate state completeness before returning
    if (state && !this.validateStateCompleteness(state)) {
      console.warn('⚠️ Incomplete state detected, discarding to prevent flashing bug');
      return null;
    }
    
    return state;
  }

  /**
   * Save state to localStorage as backup
   */
  private saveToLocalStorage(state: SerializedTimeTrackingState): void {
    try {
      localStorage.setItem(this.BACKUP_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('⚠️ Failed to save to localStorage (quota exceeded?):', error);
    }
  }

  /**
   * Load state from localStorage backup
   */
  private loadFromLocalStorage(): TimeTrackingState | null {
    try {
      const stored = localStorage.getItem(this.BACKUP_STORAGE_KEY);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored) as SerializedTimeTrackingState;
      const state = this.deserializeState(parsed);
      console.log('📦 Loaded state from localStorage backup');
      return state;
    } catch (error) {
      console.warn('⚠️ Failed to load from localStorage:', error);
      return null;
    }
  }

  /**
   * Validate that tracking state is complete to prevent "flashing" bug
   */
  private validateStateCompleteness(state: TimeTrackingState): boolean {
    // If not tracking, state is always valid
    if (!state.isTracking) return true;
    
    // If tracking, all required fields must exist
    const isComplete = !!(
      state.startTime && 
      state.eventId && 
      state.selectedProject
    );
    
    return isComplete;
  }

  /**
   * Clear localStorage backup cache
   */
  private clearBackupStorage(): void {
    try {
      localStorage.removeItem(this.BACKUP_STORAGE_KEY);
    } catch (error) {
      console.warn('⚠️ Failed to clear localStorage backup:', error);
    }
  }

  /**
   * One-time cleanup of old localStorage data
   */
  clearLegacyLocalStorage(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.BACKUP_STORAGE_KEY);
      console.log('✅ Cleared legacy localStorage time tracking data');
    } catch (error) {
      console.error('❌ Failed to clear localStorage:', error);
    }
  }
  async setupRealtimeSubscription(onStateChange: (state: TimeTrackingState) => void): Promise<any> {
    if (!this.userId) {
      throw new Error('User ID must be set before setting up realtime subscription');
    }
    try {
      const subscription = supabase
        .channel('time_tracking_changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'settings',
            filter: `user_id=eq.${this.userId}`
          },
          (payload) => {
            if (payload.new?.time_tracking_state) {
              const deserializedState = this.deserializeState(payload.new.time_tracking_state as unknown as SerializedTimeTrackingState);
              onStateChange(deserializedState);
            }
          }
        )
        .subscribe();
      return subscription;
    } catch (error) {
      console.error('❌ Failed to setup time tracking realtime subscription:', error);
      throw error;
    }
  }
  cleanupRealtimeSubscription(subscription: any): void {
    if (subscription) {
      supabase.removeChannel(subscription);
    }
  }
}
export const timeTrackingRepository = new TimeTrackingRepository();
