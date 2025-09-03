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
  currentSeconds?: number;
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
      console.log('🔧 Setting up BroadcastChannel for cross-window sync');
      
      // Check if BroadcastChannel is supported
      if ('BroadcastChannel' in window) {
        try {
          this.broadcastChannel = new BroadcastChannel('time_tracking_sync');
          console.log('✅ BroadcastChannel created successfully');
          this.setupBroadcastListener();
        } catch (error) {
          console.error('❌ Failed to create BroadcastChannel:', error);
          console.log('📝 Falling back to localStorage-only sync');
        }
      } else {
        console.log('⚠️ BroadcastChannel not supported, using localStorage-only sync');
      }
      
      this.setupStorageListener();
      
      // Add a global test function for debugging
      (window as any).testBroadcast = () => {
        console.log('🧪 Manual test: sending broadcast message');
        if (this.broadcastChannel) {
          this.broadcastChannel.postMessage({
            type: 'MANUAL_TEST',
            data: { timestamp: new Date().toISOString() }
          });
          console.log('📤 BroadcastChannel message sent');
        } else {
          console.log('❌ No BroadcastChannel available');
          // Fallback to localStorage trigger
          localStorage.setItem('timeTracker_crossWindowSync', JSON.stringify({
            type: 'MANUAL_TEST',
            data: { timestamp: new Date().toISOString() }
          }));
          setTimeout(() => {
            localStorage.removeItem('timeTracker_crossWindowSync');
          }, 100);
        }
      };
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
    console.log('🎯 Setting state change callback:', callback ? 'callback provided' : 'callback is null/undefined');
    this.onStateChangeCallback = callback;
    
    // Test the BroadcastChannel immediately
    if (this.broadcastChannel && callback) {
      console.log('🧪 Testing BroadcastChannel with immediate test message');
      setTimeout(() => {
        this.broadcastChannel.postMessage({
          type: 'TEST_MESSAGE',
          data: { test: true }
        });
      }, 100);
    }
  }

  private setupBroadcastListener() {
    if (!this.broadcastChannel) return;
    
    console.log('📻 Setting up BroadcastChannel listener');
    this.broadcastChannel.addEventListener('message', (event) => {
      console.log('📡 BroadcastChannel message received:', event.data);
      const { type, data } = event.data;
      
      if (type === 'MANUAL_TEST') {
        console.log('🧪 Manual test message received!', data);
        return;
      }
      
      if (type === 'TEST_MESSAGE') {
        console.log('🧪 Test message received successfully!');
        return;
      }
      
      if (type === 'TIME_TRACKING_STATE_CHANGED' && this.onStateChangeCallback) {
        console.log('🔄 Calling state change callback with:', data);
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
    
    console.log('📤 Broadcasting state to other windows:', state);
    
    // Use BroadcastChannel for same-origin tabs
    if (this.broadcastChannel) {
      console.log('📻 Sending via BroadcastChannel');
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