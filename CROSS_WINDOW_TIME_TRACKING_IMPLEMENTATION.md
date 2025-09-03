# Cross-Window Time Tracking Implementation Plan

## Problem Statement
The time tracker currently only shows as "running" in the session/window where it was started. The state needs to persist and synchronize across:
- Multiple browser windows/tabs of the same account
- Re-login sessions (if user starts tracking, logs out, and logs back in)

## Solution Overview
Implement a multi-layered synchronization system:
1. **Database persistence** - Store tracking state in Supabase
2. **Cross-window sync** - Use localStorage events and BroadcastChannel API
3. **Real-time updates** - Use Supabase real-time subscriptions

## Implementation Steps

### Step 1: Database Schema Changes (Supabase)

Create a new migration file: `supabase/migrations/20250903000001_add_time_tracking_state.sql`

```sql
-- Add time tracking state columns to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS time_tracking_state JSONB DEFAULT '{}';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_settings_time_tracking ON settings USING GIN (time_tracking_state);

-- Update RLS policies to allow users to update their own tracking state
-- (assuming existing RLS policies are in place)
```

### Step 2: TypeScript Types Update

After running the migration, regenerate Supabase types:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

Or manually update the types in `src/integrations/supabase/types.ts` to include:

```typescript
// Add to the settings table interface
time_tracking_state?: {
  isTracking?: boolean;
  startTime?: string; // ISO string
  eventId?: string;
  selectedProject?: any;
  searchQuery?: string;
  affectedEvents?: string[];
  lastUpdated?: string; // ISO string
} | null;
```

### Step 3: Create Cross-Window Sync Service

Create `src/services/timeTrackingSyncService.ts`:

```typescript
import { supabase } from '@/integrations/supabase/client';

interface TimeTrackingState {
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
    this.broadcastChannel = new BroadcastChannel('time_tracking_sync');
    this.setupBroadcastListener();
    this.setupStorageListener();
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
    this.broadcastChannel.addEventListener('message', (event) => {
      const { type, data } = event.data;
      if (type === 'TIME_TRACKING_STATE_CHANGED' && this.onStateChangeCallback) {
        this.onStateChangeCallback(this.deserializeState(data));
      }
    });
  }

  private setupStorageListener() {
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
    // Use BroadcastChannel for same-origin tabs
    this.broadcastChannel.postMessage({
      type: 'TIME_TRACKING_STATE_CHANGED',
      data: state
    });

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
    this.broadcastChannel.close();
  }
}

export const timeTrackingSyncService = TimeTrackingSyncService.getInstance();
```

### Step 4: Update SettingsContext

Modify `src/contexts/SettingsContext.tsx` to integrate the sync service:

Add these imports at the top:
```typescript
import { timeTrackingSyncService } from '@/services/timeTrackingSyncService';
import { useAuth } from './AuthContext';
```

In the SettingsProvider component, add:

```typescript
const { user } = useAuth();
const [realtimeSubscription, setRealtimeSubscription] = useState(null);

// Initialize sync service when user changes
useEffect(() => {
  if (user?.id) {
    timeTrackingSyncService.setUserId(user.id);
    
    // Set up callback to sync state changes from other windows
    timeTrackingSyncService.setOnStateChangeCallback((syncedState) => {
      setIsTimeTracking(syncedState.isTracking);
      // Update other relevant state if needed
    });

    // Load initial state from database
    const loadInitialState = async () => {
      const dbState = await timeTrackingSyncService.loadStateFromDatabase();
      if (dbState) {
        setIsTimeTracking(dbState.isTracking);
        // Set other state values as needed
      }
    };
    
    loadInitialState();

    // Set up real-time subscription
    const setupRealtime = async () => {
      const subscription = await timeTrackingSyncService.setupRealtimeSubscription();
      setRealtimeSubscription(subscription);
    };
    
    setupRealtime();
  }

  return () => {
    if (realtimeSubscription) {
      realtimeSubscription.unsubscribe();
    }
  };
}, [user?.id]);

// Update setIsTimeTracking to sync to database
const setIsTimeTrackingWithSync = useCallback(async (isTracking: boolean) => {
  setIsTimeTracking(isTracking);
  
  if (user?.id) {
    await timeTrackingSyncService.syncStateToDatabase({
      isTracking,
      lastUpdated: new Date()
      // Add other relevant state
    });
  }
}, [user?.id]);
```

And update the context value to use the new setter:
```typescript
setIsTimeTracking: setIsTimeTrackingWithSync,
```

### Step 5: Update TimeTracker Component

Modify `src/components/work-hours/TimeTracker.tsx` to use the sync service:

1. Import the sync service
2. Update the tracking start/stop functions to sync full state
3. Load state from database on component mount

Key changes:

```typescript
import { timeTrackingSyncService } from '@/services/timeTrackingSyncService';

// In the component, update the saveTrackingState function:
const saveTrackingState = async (trackingData: {
  isTracking: boolean;
  startTime?: Date;
  eventId?: string | null;
  selectedProject?: any;
  searchQuery?: string;
  affectedEvents?: string[];
}) => {
  // Save to localStorage (existing)
  TimeTrackerCalculationService.saveTrackingState(trackingData);
  
  // Sync to database and other windows
  if (user?.id) {
    await timeTrackingSyncService.syncStateToDatabase({
      ...trackingData,
      lastUpdated: new Date()
    });
  }
};
```

### Step 6: Testing Instructions

1. **Cross-window sync test**:
   - Open the app in two browser tabs
   - Start tracking in one tab
   - Verify the other tab shows tracking state
   - Stop tracking in the second tab
   - Verify the first tab updates

2. **Login persistence test**:
   - Start tracking
   - Log out
   - Log back in
   - Verify tracking is still active

3. **Database persistence test**:
   - Start tracking
   - Close all browser windows
   - Open the app again
   - Verify tracking state is restored

### Step 7: Migration Commands for Lovable

```bash
# 1. Create and run the migration
supabase migration new add_time_tracking_state
# (Add the SQL content from Step 1)
supabase db push

# 2. Regenerate types
supabase gen types typescript > src/integrations/supabase/types.ts

# 3. Test the implementation
npm run dev
```

### Step 8: Error Handling and Edge Cases

1. **Network connectivity**: Handle offline scenarios gracefully
2. **Concurrent updates**: Handle conflicts when multiple windows update simultaneously
3. **Stale data**: Implement timestamp-based conflict resolution
4. **Cleanup**: Clear expired tracking sessions (add cleanup job)

### Step 9: Performance Considerations

1. **Debouncing**: Limit database updates to prevent excessive API calls
2. **Caching**: Cache state locally and only sync when necessary
3. **Subscriptions**: Properly manage real-time subscriptions to prevent memory leaks

## Files to Create/Modify

### New Files:
- `src/services/timeTrackingSyncService.ts`
- `supabase/migrations/20250903000001_add_time_tracking_state.sql`

### Modified Files:
- `src/contexts/SettingsContext.tsx`
- `src/components/work-hours/TimeTracker.tsx`
- `src/integrations/supabase/types.ts` (regenerated)

## Expected Behavior After Implementation

1. **Single source of truth**: Database becomes the authoritative source for tracking state
2. **Real-time sync**: All windows update immediately when tracking starts/stops
3. **Persistent sessions**: Tracking continues across login sessions
4. **Conflict resolution**: Latest update wins in case of conflicts
5. **Graceful degradation**: Works offline with localStorage fallback

This implementation provides a robust, scalable solution for cross-window time tracking synchronization while maintaining good performance and user experience.
