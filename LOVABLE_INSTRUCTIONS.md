# Instructions for Lovable: Complete Auto-Estimate Days Feature

## Summary
I've implemented the Auto-Estimate Days feature UI and calculation logic. The feature allows users to exclude specific days of the week from auto-estimation calculations. However, to make this feature fully persistent, Lovable needs to complete the database integration.

## What's Already Working:
1. ✅ UI component added to Project Modal with proper styling
2. ✅ Auto-estimate days selection (7 checkboxes for days of the week)
3. ✅ Calculation logic integrated into existing auto-estimation system
4. ✅ Local state management in the modal
5. ✅ Frontend TypeScript types updated

## What Lovable Needs to Complete:

### 1. Database Migration
Apply the migration file that's already created at `supabase/migrations/20250902000000_add_auto_estimate_days.sql`:

```sql
-- Add auto_estimate_days column to projects table
-- This column stores which days of the week should be included in auto-estimation

DO $$
BEGIN
    -- Add auto_estimate_days column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'projects' 
                   AND column_name = 'auto_estimate_days' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.projects 
        ADD COLUMN auto_estimate_days JSONB DEFAULT '{
            "monday": true,
            "tuesday": true,
            "wednesday": true,
            "thursday": true,
            "friday": true,
            "saturday": true,
            "sunday": true
        }'::jsonb;
    END IF;
END $$;

-- Add comment to document the column
COMMENT ON COLUMN public.projects.auto_estimate_days IS 'JSONB object defining which days of the week are included in auto-estimation calculations. Each day key maps to a boolean value.';
```

### 2. Update Database Types
After the migration, regenerate the TypeScript types so the `auto_estimate_days` field is recognized.

### 3. Enable Database Persistence
In `src/hooks/useProjects.ts`, uncomment these two lines:

**In `transformToDatabase` function (around line 53):**
```typescript
// Currently commented: 
// if (projectData.autoEstimateDays !== undefined) dbData.auto_estimate_days = projectData.autoEstimateDays;

// Uncomment this line:
if (projectData.autoEstimateDays !== undefined) dbData.auto_estimate_days = projectData.autoEstimateDays;
```

**In `transformDatabaseProject` function (around line 27):**
```typescript
// Currently uses hardcoded default:
autoEstimateDays: {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: true,
  sunday: true,
},

// Change to:
autoEstimateDays: dbProject.auto_estimate_days || {
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: true,
  sunday: true,
},
```

### 4. Re-enable Database Saves
In `src/components/modals/ProjectModal.tsx`, replace the localStorage handler (around line 691) with database saves:

```typescript
// Currently using localStorage:
const handleAutoEstimateDaysChange = useCallback((newAutoEstimateDays: any) => {
  setLocalValues(prev => ({ ...prev, autoEstimateDays: newAutoEstimateDays }));
  // Store in localStorage for this project
  if (projectId) {
    localStorage.setItem(`autoEstimateDays_${projectId}`, JSON.stringify(newAutoEstimateDays));
  }
}, [projectId]);

// Change to:
const handleAutoEstimateDaysChange = useCallback((newAutoEstimateDays: any) => {
  setLocalValues(prev => ({ ...prev, autoEstimateDays: newAutoEstimateDays }));
  if (!isCreating && projectId) {
    updateProject(projectId, { autoEstimateDays: newAutoEstimateDays }, { silent: true });
  }
}, [isCreating, projectId, updateProject]);
```

And in the same file, re-add the callback prop (around line 1450):
```typescript
<AutoEstimateDaysSection
  isExpanded={isAutoEstimateDaysExpanded}
  onToggle={() => setIsAutoEstimateDaysExpanded(!isAutoEstimateDaysExpanded)}
  localValues={localValues}
  setLocalValues={setLocalValues}
  onAutoEstimateDaysChange={handleAutoEstimateDaysChange}
/>
```

And in `src/components/projects/modal/AutoEstimateDaysSection.tsx`, update the interface and function:

```typescript
// Add this prop back to the interface:
interface AutoEstimateDaysSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  localValues: {
    // ... existing props
  };
  setLocalValues: (updater: (prev: any) => any) => void;
  onAutoEstimateDaysChange?: (newAutoEstimateDays: any) => void; // Add this back
}

// Update the function signature:
export function AutoEstimateDaysSection({
  isExpanded,
  onToggle,
  localValues,
  setLocalValues,
  onAutoEstimateDaysChange, // Add this back
}: AutoEstimateDaysSectionProps) {

// And update the handleDayToggle function:
const handleDayToggle = (day: keyof typeof autoEstimateDays) => {
  const newAutoEstimateDays = {
    ...autoEstimateDays,
    [day]: !autoEstimateDays[day],
  };
  
  setLocalValues(prev => ({
    ...prev,
    autoEstimateDays: newAutoEstimateDays,
  }));
  
  // Call the change handler if provided (for immediate persistence)
  if (onAutoEstimateDaysChange) {
    onAutoEstimateDaysChange(newAutoEstimateDays);
  }
};
```

## How It Works:
1. User opens project modal
2. Clicks "Auto-Estimate Days" toggle to expand section
3. Unchecks days they want to exclude from auto-estimation
4. Changes are saved to database immediately
5. Auto-estimation calculations now skip the excluded days when distributing project hours

## Testing:
1. Create a new project
2. Set Auto-Estimate Days to exclude weekends
3. Check that project bars only distribute time across weekdays
4. Verify settings persist when reopening the project modal

The feature is fully functional except for the database persistence, which just needs these Lovable changes to complete!
