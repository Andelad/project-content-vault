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
      lastUpdateTime: (state.lastUpdateTime || state.lastUpdated)?.toISOString() || null
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

      // Update localStorage cache
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        state: serializedState,
        timestamp: Date.now()
      }));

      console.log('✅ Time tracking state saved successfully');
    } catch (error) {
      console.error('❌ Failed to save time tracking state:', error);
      throw error;
    }
  }

  async loadState(): Promise<TimeTrackingState | null> {
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

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error loading time tracking state from database:', error);
        // Fallback to localStorage
        return this.loadFromLocalStorage();
      }

      if (data?.time_tracking_state) {
        const deserializedState = this.deserializeState(data.time_tracking_state as unknown as SerializedTimeTrackingState);
        console.log('✅ Time tracking state loaded from database');
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
          console.log('✅ Time tracking state loaded from localStorage');
          return this.deserializeState(parsed.state);
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
            console.log('📡 Received time tracking state update from database:', payload);
            
            if (payload.new?.time_tracking_state) {
              const deserializedState = this.deserializeState(payload.new.time_tracking_state as unknown as SerializedTimeTrackingState);
              onStateChange(deserializedState);
            }
          }
        )
        .subscribe();

      console.log('✅ Time tracking realtime subscription setup complete');
      return subscription;
    } catch (error) {
      console.error('❌ Failed to setup time tracking realtime subscription:', error);
      throw error;
    }
  }

  cleanupRealtimeSubscription(subscription: any): void {
    if (subscription) {
      supabase.removeChannel(subscription);
      console.log('🧹 Time tracking realtime subscription cleaned up');
    }
  }
}

export const timeTrackingRepository = new TimeTrackingRepository();
