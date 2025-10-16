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
    
    // Log the stack trace to see WHO is calling saveState
    console.log('🔍 SAVE STATE - Called from:', new Error().stack?.split('\n').slice(2, 5).join('\n'));
    
    console.log('🔍 SAVE STATE - Input state:', {
      isTracking: state.isTracking,
      startTime: state.startTime,
      eventId: state.eventId,
      selectedProject: state.selectedProject?.name || state.selectedProject,
      searchQuery: state.searchQuery,
      hasAllFields: !!(state.eventId && state.selectedProject && state.startTime)
    });
    const serializedState = this.serializeState(state);
    console.log('🔍 SAVE STATE - Serialized state:', serializedState);
    try {
      // Save to database
      const { error } = await supabase
        .from('settings')
        .upsert({
          user_id: this.userId,
          time_tracking_state: serializedState as any
        }, {
          onConflict: 'user_id'
        });
      if (error) {
        console.error('Error saving time tracking state to database:', error);
        throw error;
      }
      
      // Verify what was actually saved
      const { data: verifyData } = await supabase
        .from('settings')
        .select('time_tracking_state')
        .eq('user_id', this.userId)
        .single();
      console.log('🔍 VERIFY - What is actually in DB:', verifyData?.time_tracking_state);
      
      // Update localStorage cache
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        state: serializedState,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('❌ Failed to save time tracking state:', error);
      throw error;
    }
  }
  async loadState(): Promise<TimeTrackingState | null> {
    console.log('🔍 LOAD STATE - userId:', this.userId);
    
    if (!this.userId) {
      // Try to load from localStorage if no user ID
      return this.loadFromLocalStorage();
    }
    try {
      // Try to load from database first
      const { data, error } = await supabase
        .from('settings')
        .select('time_tracking_state')
        .eq('user_id', this.userId)
        .single();
      
      console.log('🔍 LOAD STATE - DB data:', data?.time_tracking_state);
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error loading time tracking state from database:', error);
        // Fallback to localStorage
        return this.loadFromLocalStorage();
      }
      if (data?.time_tracking_state) {
        // Handle both serialized and full state objects
        const stateData = data.time_tracking_state as any;
        let deserializedState: TimeTrackingState;
        
        // Check if it's already a full state object or just serialized
        if (stateData.eventId !== undefined || stateData.selectedProject !== undefined) {
          // It's a full state object, convert it
          deserializedState = {
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
          // It's a serialized state object
          deserializedState = this.deserializeState(stateData as SerializedTimeTrackingState);
        }
        
        console.log('🔍 LOAD STATE - Returning state:', {
          isTracking: deserializedState.isTracking,
          eventId: deserializedState.eventId,
          selectedProject: deserializedState.selectedProject,
          searchQuery: deserializedState.searchQuery,
          startTime: deserializedState.startTime
        });
        
        return deserializedState;
      }
      // Fallback to localStorage
      return this.loadFromLocalStorage();
    } catch (error) {
      console.error('❌ Failed to load time tracking state from database:', error);
      return this.loadFromLocalStorage();
    }
  }
  private loadFromLocalStorage(): TimeTrackingState | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.state) {
          // Handle both serialized and full state objects
          const stateData = parsed.state;
          if (stateData.eventId !== undefined || stateData.selectedProject !== undefined) {
            // It's a full state object
            return {
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
            // It's a serialized state object
            return this.deserializeState(stateData);
          }
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to load time tracking state from localStorage:', error);
      return null;
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
