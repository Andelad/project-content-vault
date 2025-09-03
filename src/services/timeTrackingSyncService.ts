/**
 * Cross-Window Time Tracking Synchronization Service
 * 
 * Handles multi-layered synchronization of time tracking state:
 * 1. Database persistence via Supabase
 * 2. Cross-window sync via BroadcastChannel and localStorage
 * 3. Real-time updates via Supabase subscriptions
 */

import { supabase } from '@/integrations/supabase/client';

export interface TimeTrackingState {
  isTracking: boolean;
  startTime?: Date;
  eventId?: string | null;
  selectedProject?: any;
  searchQuery?: string;
  affectedEvents?: string[];
  lastUpdated?: Date;
}

class TimeTrackingSyncService {
  private static instance: TimeTrackingSyncService;
  private broadcastChannel: BroadcastChannel;
  private userId: string | null = null;
  private onStateChangeCallback?: (state: TimeTrackingState) => void;

  constructor() {
    if (typeof window !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('time_tracking_sync');
      this.setupBroadcastListener();
      this.setupStorageListener();
    }
  }

  static getInstance(): TimeTrackingSyncService {
    if (!this.instance) {
      this.instance = new TimeTrackingSyncService();
    }
    return this.instance;
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  setOnStateChangeCallback(callback: (state: TimeTrackingState) => void) {
    this.onStateChangeCallback = callback;
  }

  private setupBroadcastListener() {
    if (!this.broadcastChannel) return;
    
    this.broadcastChannel.addEventListener('message', (event) => {
      const { type, data } = event.data;
      if (type === 'TIME_TRACKING_STATE_CHANGED' && this.onStateChangeCallback) {
        this.onStateChangeCallback(this.deserializeState(data));
      }
    });
  }

  private setupStorageListener() {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('storage', (event) => {
      if (event.key === 'timeTracker_crossWindowSync' && event.newValue) {
        const data = JSON.parse(event.newValue);
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback(this.deserializeState(data));
        }
      }
    });
  }

  private serializeState(state: TimeTrackingState) {
    return {
      ...state,
      startTime: state.startTime?.toISOString(),
      lastUpdated: new Date().toISOString()
    };
  }

  private deserializeState(data: any): TimeTrackingState {
    return {
      ...data,
      startTime: data.startTime ? new Date(data.startTime) : undefined,
      lastUpdated: data.lastUpdated ? new Date(data.lastUpdated) : undefined
    };
  }

  async syncStateToDatabase(state: TimeTrackingState) {
    if (!this.userId) return;

    try {
      const serializedState = this.serializeState(state);
      
      const { error } = await supabase
        .from('settings')
        .upsert({
          user_id: this.userId,
          time_tracking_state: serializedState
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Failed to sync tracking state to database:', error);
        return;
      }

      // Broadcast to other windows
      this.broadcastToOtherWindows(serializedState);
      
    } catch (error) {
      console.error('Error syncing tracking state:', error);
    }
  }

  async loadStateFromDatabase(): Promise<TimeTrackingState | null> {
    if (!this.userId) return null;

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('time_tracking_state')
        .eq('user_id', this.userId)
        .single();

      if (error || !data?.time_tracking_state) {
        return null;
      }

      return this.deserializeState(data.time_tracking_state);
    } catch (error) {
      console.error('Error loading tracking state from database:', error);
      return null;
    }
  }

  private broadcastToOtherWindows(state: any) {
    if (typeof window === 'undefined') return;
    
    // Use BroadcastChannel for same-origin tabs
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'TIME_TRACKING_STATE_CHANGED',
        data: state
      });
    }

    // Use localStorage for broader compatibility
    localStorage.setItem('timeTracker_crossWindowSync', JSON.stringify(state));
    // Clear the storage item immediately to trigger the event
    setTimeout(() => {
      localStorage.removeItem('timeTracker_crossWindowSync');
    }, 100);
  }

  async setupRealtimeSubscription() {
    if (!this.userId) return;

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
          const newState = payload.new?.time_tracking_state;
          if (newState && this.onStateChangeCallback) {
            this.onStateChangeCallback(this.deserializeState(newState));
          }
        }
      )
      .subscribe();

    return subscription;
  }

  destroy() {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
  }
}

export const timeTrackingSyncService = TimeTrackingSyncService.getInstance();