# Milestone System Analysis & Migration Plan

## Executive Summary

**Current State**: Milestone system is broken - milestones not appearing within project date limits. System uses redundant `order_index` field alongside dates.

**Proposed State**: Date-driven milestone system with recurring milestone support. Remove `order_index` entirely as it's redundant with date-based ordering.

**Migration Strategy**: Safe migration with backward compatibility for existing users, default date assignment, and gradual rollout.

---

## Step 0: Current Logic Summary

### Current Milestone System Architecture

**Database Schema** (from migrations):
```sql
CREATE TABLE milestones (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  due_date DATE NOT NULL,
  time_allocation INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_milestones_project_id ON milestones(project_id);
CREATE INDEX idx_milestones_order_index ON milestones(order_index);
CREATE INDEX idx_milestones_due_date ON milestones(due_date);
```

**TypeScript Interface** (`src/types/core.ts`):
```typescript
interface Milestone {
  id: string;
  name: string;
  projectId: string;
  dueDate: Date;
  timeAllocation?: number;
  order: number; // Maps to order_index in DB
}
```

### Current Business Rules (`src/domain/rules/MilestoneRules.ts`)

**Key Functions**:
- `validateMilestoneOrders()`: Checks for duplicate order_index values
- `normalizeMilestoneOrders()`: Sorts milestones by due_date and assigns sequential order_index

**Current Logic Flow**:
1. Milestones stored with both `due_date` and `order_index`
2. `order_index` can become non-sequential (e.g., 176, 210) through operations
3. Normalization logic attempts to keep `order_index` synced with date chronology
4. Display logic uses `order_index` for sorting rather than dates

### Current Issues Identified

1. **Milestones not appearing within project date limits**
   - Likely due to filtering logic using `order_index` instead of dates
   - Project date constraints not properly applied

2. **Redundant ordering system**
   - `order_index` duplicates date-based ordering
   - Normalization logic suggests dates are primary

3. **No recurring milestone support**
   - No database fields for recurrence patterns
   - No logic for generating recurring milestones

---

## Step 1: Current Milestone Review

### Data Flow Analysis

**Creation** (`useMilestones.ts`):
```typescript
const addMilestone = async (milestone: Omit<Milestone, 'id' | 'order'>) => {
  const nextOrderIndex = Math.max(...milestones.map(m => m.order), 0) + 1;
  // Creates milestone with calculated order_index
};
```

**Reordering** (`useMilestones.ts`):
```typescript
const reorderMilestones = async (sourceIndex: number, destinationIndex: number) => {
  // Updates order_index values independently of dates
  // Can create non-sequential numbers like 176, 210
};
```

**Display Logic** (Components):
- Uses `order_index` for sorting in lists
- May not respect project date boundaries

### Current Filtering Issues

**Problem**: Milestones not appearing within project date limits
**Likely Cause**: Filtering logic prioritizes `order_index` over date constraints
**Evidence**: Normalization functions exist to sync order with dates, suggesting date filtering is secondary

---

## Step 2: Recurring Milestones Design

### Proposed Database Schema Extension

```sql
-- Add to milestones table
ALTER TABLE milestones ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE milestones ADD COLUMN recurrence_pattern JSONB; -- {type: 'weekly', interval: 1, endDate?: Date}

-- Optional: Instance table for performance
CREATE TABLE milestone_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  instance_date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Recurrence Pattern Types

```typescript
type RecurrencePattern = {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // Every N days/weeks/months/years
  endDate?: Date; // Optional end date for finite recurrences
  daysOfWeek?: number[]; // For weekly: [1,3,5] = Mon, Wed, Fri
  daysOfMonth?: number[]; // For monthly: [1,15] = 1st and 15th
};
```

### Generation Logic

**For Finite Projects**:
- Generate instances within project start/end dates
- Store as separate `milestone_instances` records

**For Continuous Projects**:
- Generate instances on-demand (next 30 days)
- Virtual instances for future dates
- Lazy loading to avoid performance issues

---

## Step 3: Migration Preparation Assessment

### Required Fixes Before Migration

1. **Fix Current Filtering Logic**
   - Update display components to respect project date boundaries
   - Ensure milestones are filtered by project start/end dates

2. **Database Migration Preparation**
   - Add recurring fields to schema
   - Create migration scripts for backward compatibility

3. **Default Date Assignment**
   - For existing milestones without proper dates: `project.startDate + 1 day`
   - Ensure no milestones exist before project start

### Backward Compatibility Strategy

**For Existing Users**:
1. **Data Migration**: Assign default dates to existing milestones
2. **Gradual Rollout**: Keep `order_index` during transition
3. **Fallback Logic**: Support both old and new ordering systems

**Migration Steps**:
1. Add recurring fields to database
2. Fix current filtering issues
3. Implement date-driven ordering alongside existing system
4. Gradually phase out `order_index`
5. Remove `order_index` in future version

---

## Implementation Plan

### Phase 1: Fix Current Issues (Immediate Priority)

**Tasks**:
1. Identify why milestones aren't showing within project limits
2. Fix filtering logic to use dates over order_index
3. Add project boundary validation

**Files to Update**:
- `src/components/projects/ProjectMilestoneList.tsx` (likely filtering logic)
- `src/hooks/useMilestones.ts` (data fetching)
- `src/services/MilestoneService.ts` (business logic)

### Phase 2: Add Recurring Milestone Support

**Tasks**:
1. Database migration for recurring fields
2. Update Milestone interface
3. Implement recurrence pattern logic
4. Add UI for creating recurring milestones

### Phase 3: Migrate to Date-Driven System

**Tasks**:
1. Remove `order_index` from database
2. Update all code to use date-based ordering
3. Simplify business rules
4. Update components to use date sorting

---

## Lovable Implementation Instructions

### Database Changes Required

```sql
-- Add recurring support
ALTER TABLE milestones ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE milestones ADD COLUMN recurrence_pattern JSONB;

-- Optional: Instance table for performance
CREATE TABLE milestone_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  instance_date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_milestone_instances_milestone_id ON milestone_instances(milestone_id);
CREATE INDEX idx_milestone_instances_date ON milestone_instances(instance_date);
```

### Code Changes Required

1. **Update TypeScript Interfaces**
2. **Fix Filtering Logic** - Ensure milestones respect project date boundaries
3. **Add Recurring Logic** - Pattern generation and instance management
4. **Remove order_index** - Replace with date-based ordering

### Testing Requirements

1. **Backward Compatibility**: Existing milestones should continue working
2. **Date Filtering**: Milestones should appear within project limits
3. **Recurring Generation**: Should create appropriate instances without overload
4. **Migration Safety**: No data loss during transition

---

## Risk Assessment

**High Risk**: Current system broken - milestones not displaying
**Medium Risk**: Migration complexity with existing users
**Low Risk**: Recurring milestone addition (additive change)

**Mitigation**:
- Fix current issues first before migration
- Gradual rollout with feature flags
- Comprehensive testing of date filtering
- Backup data before schema changes

---

## Immediate Action Required

**CRITICAL BUG**: Milestones not respecting project date boundaries

**Fix Location**: `src/components/projects/modal/ProjectMilestoneSection.tsx:498-510`

**Current Code**:
```typescript
const existing = Array.isArray(milestones) ? milestones.filter(m => m.projectId === projectId) : [];
```

**Fix Code**:
```typescript
const existing = Array.isArray(milestones) ? milestones.filter(m => 
  m.projectId === projectId && 
  m.dueDate >= projectStartDate && 
  m.dueDate <= projectEndDate
) : [];
```

**Dependencies**: Add `projectStartDate, projectEndDate` to useMemo dependency array

This fix will immediately resolve the issue where milestones appear outside project date limits.

---

## Backward Compatibility & Migration Strategy

### For Existing Users with Out-of-Bounds Milestones

**Problem**: Some users may have milestones with dates outside their project boundaries
**Solution**: Implement default date assignment during migration

**Migration Logic**:
1. For milestones before project start: `dueDate = projectStartDate + 1 day`
2. For milestones after project end: `dueDate = projectEndDate - 1 day` (if not continuous)
3. Preserve relative ordering within valid date ranges

**Example Migration Query**:
```sql
-- Update milestones outside project boundaries
UPDATE milestones 
SET due_date = GREATEST(
  LEAST(due_date, projects.end_date - INTERVAL '1 day'), 
  projects.start_date + INTERVAL '1 day'
)
FROM projects 
WHERE milestones.project_id = projects.id
AND (milestones.due_date < projects.start_date OR milestones.due_date > projects.end_date);
```

### Recurring Milestones Implementation

**Simple Pattern System**:
- **Daily**: Every N days from project start
- **Weekly**: Every N weeks on specified day(s)
- **Monthly**: Every N months on specified date/day pattern
- **Continuous Projects**: Generate instances on-demand (lazy loading)

**Performance Strategy**:
- For finite projects: Pre-generate all instances
- For continuous projects: Generate next 30 days, lazy load more
- Maximum 1000 instances per recurring milestone to prevent overload

**Database Design**:
```sql
-- Template milestone (is_recurring = true)
-- Generated instances (separate table for performance)
CREATE TABLE milestone_instances (
  id UUID PRIMARY KEY,
  milestone_id UUID REFERENCES milestones(id),
  instance_date DATE NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE
);
```
