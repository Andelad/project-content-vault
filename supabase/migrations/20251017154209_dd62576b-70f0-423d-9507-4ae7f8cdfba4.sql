-- Clean up incomplete time tracking state records
-- This fixes records where tracking is stopped (isTracking: false) but still has orphaned eventId
UPDATE settings 
SET time_tracking_state = jsonb_build_object(
  'isTracking', false,
  'isPaused', false,
  'projectId', null,
  'startTime', null,
  'pausedAt', null,
  'totalPausedDuration', 0,
  'lastUpdateTime', now(),
  'eventId', null,
  'selectedProject', null,
  'searchQuery', '',
  'affectedEvents', '[]'::jsonb,
  'currentSeconds', 0
)
WHERE (time_tracking_state->>'isTracking')::boolean = false
  AND time_tracking_state->>'eventId' IS NOT NULL;