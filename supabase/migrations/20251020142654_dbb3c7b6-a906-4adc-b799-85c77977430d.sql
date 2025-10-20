-- Phase 1: Remove order_index (redundant with date-based ordering)
-- Milestones are naturally ordered by dates, not manual positioning

-- Drop the order_index column and its index
DROP INDEX IF EXISTS idx_milestones_order_index;
ALTER TABLE milestones DROP COLUMN IF EXISTS order_index;

-- Add comment to clarify milestone purpose
COMMENT ON TABLE milestones IS 'Project milestones define time allocation segments for forecasting. They are not tasks - actual work is tracked via calendar_events. Milestones drive day estimate calculations to help users plan capacity.';

COMMENT ON COLUMN milestones.time_allocation_hours IS 'Hours allocated to this milestone segment (used for day estimate calculations)';
COMMENT ON COLUMN milestones.is_recurring IS 'Whether this milestone follows a recurring pattern (instances generated virtually)';
COMMENT ON COLUMN milestones.recurring_config IS 'Pattern configuration: {type: "daily"|"weekly"|"monthly", interval: number, weeklyDayOfWeek?: 0-6, monthlyPattern?: "date"|"dayOfWeek", monthlyDate?: 1-31, monthlyWeekOfMonth?: 1-5, monthlyDayOfWeek?: 0-6}';

-- Ensure we have proper indexes for date-based queries
CREATE INDEX IF NOT EXISTS idx_milestones_dates ON milestones(project_id, start_date, due_date);
CREATE INDEX IF NOT EXISTS idx_milestones_recurring ON milestones(project_id, is_recurring) WHERE is_recurring = true;