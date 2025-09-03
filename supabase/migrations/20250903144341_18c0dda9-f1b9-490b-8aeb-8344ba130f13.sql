-- Add time tracking state columns to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS time_tracking_state JSONB DEFAULT '{}';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_settings_time_tracking ON settings USING GIN (time_tracking_state);