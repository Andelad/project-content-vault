-- ============================================================================
-- PREVIEW: What milestones would be deleted by Phase 0 cleanup?
-- ============================================================================
-- This is a READ-ONLY query to preview the cleanup without making changes
-- Run this FIRST to see what would be deleted, then decide if you want to proceed

-- Query 1: Summary by violation type
SELECT 
  CASE
    WHEN p.id IS NULL THEN 'ORPHANED (no project exists)'
    WHEN m.due_date < p.start_date THEN 'BEFORE_PROJECT_START'
    WHEN m.due_date > p.end_date AND p.continuous = false THEN 'AFTER_PROJECT_END'
    ELSE 'UNKNOWN'
  END AS violation_type,
  COUNT(*) as milestone_count
FROM milestones m
LEFT JOIN projects p ON m.project_id = p.id
WHERE 
  p.id IS NULL
  OR m.due_date < p.start_date
  OR (m.due_date > p.end_date AND p.continuous = false)
GROUP BY violation_type
ORDER BY milestone_count DESC;

-- Query 2: Detailed list of invalid milestones
SELECT 
  m.id,
  m.name AS milestone_name,
  m.due_date,
  m.order_index,
  p.name AS project_name,
  p.start_date AS project_start,
  p.end_date AS project_end,
  CASE
    WHEN p.id IS NULL THEN 'ORPHANED - Project does not exist'
    WHEN m.due_date < p.start_date THEN 
      'BEFORE START - ' || (p.start_date - m.due_date) || ' days before project start'
    WHEN m.due_date > p.end_date AND p.continuous = false THEN 
      'AFTER END - ' || (m.due_date - p.end_date) || ' days after project end'
    ELSE 'UNKNOWN'
  END AS violation_details
FROM milestones m
LEFT JOIN projects p ON m.project_id = p.id
WHERE 
  p.id IS NULL
  OR m.due_date < p.start_date
  OR (m.due_date > p.end_date AND p.continuous = false)
ORDER BY 
  CASE
    WHEN p.id IS NULL THEN 1
    WHEN m.due_date < p.start_date THEN 2
    ELSE 3
  END,
  p.name,
  m.due_date;

-- Query 3: Projects with the most invalid milestones
SELECT 
  p.name AS project_name,
  p.start_date AS project_start,
  p.end_date AS project_end,
  COUNT(m.id) AS invalid_milestone_count,
  STRING_AGG(m.name || ' (' || m.due_date || ')', ', ' ORDER BY m.due_date) AS milestone_list
FROM milestones m
LEFT JOIN projects p ON m.project_id = p.id
WHERE 
  p.id IS NOT NULL
  AND (
    m.due_date < p.start_date
    OR (m.due_date > p.end_date AND p.continuous = false)
  )
GROUP BY p.id, p.name, p.start_date, p.end_date
ORDER BY invalid_milestone_count DESC
LIMIT 20;

-- Query 4: Check for the specific "milestone 1010" issue
SELECT 
  m.id,
  m.name,
  m.order_index,
  m.due_date,
  p.name AS project_name,
  p.start_date,
  p.end_date,
  CASE
    WHEN m.order_index > 100 THEN '⚠️  Abnormally high order_index'
    WHEN m.due_date < p.start_date OR m.due_date > p.end_date THEN '⚠️  Outside project dates'
    ELSE 'Valid'
  END AS status
FROM milestones m
JOIN projects p ON m.project_id = p.id
WHERE m.order_index > 100
   OR m.due_date < p.start_date
   OR (m.due_date > p.end_date AND p.continuous = false)
ORDER BY m.order_index DESC, m.due_date;

-- Summary message
DO $$
DECLARE
  total_invalid INTEGER;
  total_milestones INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_invalid
  FROM milestones m
  LEFT JOIN projects p ON m.project_id = p.id
  WHERE p.id IS NULL
     OR m.due_date < p.start_date
     OR (m.due_date > p.end_date AND p.continuous = false);
  
  SELECT COUNT(*) INTO total_milestones FROM milestones;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CLEANUP PREVIEW SUMMARY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total milestones in database: %', total_milestones;
  RAISE NOTICE 'Invalid milestones to delete: %', total_invalid;
  RAISE NOTICE 'Valid milestones to keep: %', total_milestones - total_invalid;
  RAISE NOTICE 'Percentage to delete: %%%', ROUND((total_invalid::NUMERIC / total_milestones * 100), 2);
  RAISE NOTICE '';
  RAISE NOTICE 'Review the query results above for details.';
  RAISE NOTICE 'If you want to proceed with cleanup, run the Phase 0 migration.';
  RAISE NOTICE '========================================';
END $$;
