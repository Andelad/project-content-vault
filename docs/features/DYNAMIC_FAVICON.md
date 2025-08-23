# Dynamic Favicon for Time Tracking

This feature automatically changes the browser's favicon to a red record symbol when the time tracker is active, providing visual feedback to users even when they're working in other tabs or applications.

## How it Works

### 1. Favicon Hook (`src/hooks/useFavicon.ts`)
- Creates a custom React hook that manages favicon switching
- Generates an SVG-based red record symbol dynamically
- Handles cleanup of object URLs to prevent memory leaks
- Switches between the default favicon and the recording symbol

### 2. Global State Management
The time tracking state is managed globally through the app context:
- **AppContext**: Added `isTimeTracking` state and `setIsTimeTracking` action
- **AppStateContext**: Includes tracking state in the global state
- **AppActionsContext**: Provides the setter function to components

### 3. TimeTracker Component Integration
- Updated to use global `isTimeTracking` state instead of local state
- Removed direct favicon management (now handled at app level)
- All `isTracking` references updated to `isTimeTracking`

### 4. App-Level Integration
- The `useFavicon` hook is called in the main `AuthenticatedContent` component
- This ensures the favicon updates regardless of where the TimeTracker is used
- Works across all views and components

## Visual Design

The red record symbol favicon features:
- Circular red gradient design (from #ff4444 to #cc0000)
- Dark red stroke border (#990000)
- Small central circle (#660000) for the classic "record" look
- 32x32 viewBox for crisp display at small sizes

## Technical Details

### Memory Management
- Object URLs are properly cleaned up when switching away from recording mode
- No memory leaks from repeated favicon changes

### Persistence
- The time tracking state persists across page refreshes via localStorage
- Favicon automatically updates on app load if tracking was active

### Browser Compatibility
- Uses SVG favicons with fallback to ICO format
- Works across modern browsers that support dynamic favicon changes

## Usage

The feature works automatically:
1. When time tracking starts → favicon changes to red record symbol
2. When time tracking stops → favicon reverts to default
3. No user interaction required beyond starting/stopping the tracker

This provides immediate visual feedback to users, making it easy to see at a glance whether time tracking is active, even when working in other browser tabs or applications.
