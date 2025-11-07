# Phase Time Domain Rules - Implementation Plan

**Date:** 7 November 2025  
**Status:** ✅ Core Implementation Complete - Testing Phase

## Overview
We are implementing new domain rules for how phases (milestones with startDate/endDate) handle estimated time in relation to today's date. This represents a significant shift from previous milestone logic.

## Implementation Status

### ✅ Completed
1. **Domain Rule Methods** - All 7 new methods added to ProjectRules.ts and MilestoneRules.ts
2. **Past Day Filtering** - dayEstimateCalculations.ts updated to exclude past days
3. **Validation Integration** - ProjectOrchestrator.validateProjectCreation includes past validation
4. **Auto-Adjustment Workflow** - ProjectOrchestrator.executeProjectCreationWorkflow auto-adjusts phases
5. **UI Notifications** - ProjectModal displays warnings when dates are auto-adjusted

### ⏳ Pending
1. **Testing** - Real-world testing with ScotWind project and phase scenarios
2. **Legacy Logic Cleanup** - Remove/update competing validation in RelationshipRules.ts
3. **Update Workflow** - Add auto-adjustment to project update/edit workflows
4. **Phase Spacing Validation** - Wire up validatePhaseSpacing in phase creation UI

## New Domain Rules

### Rule 1: No Estimated Time in the Past
**Statement:** If a project/phase has estimated time (hours > 0), working days should only include today and future days.

**Impact:** 
- Past days are excluded from auto-estimate calculations
- Only today + future working days receive estimated time distribution

### Rule 2: Minimum Future Duration
**Statement:** If there is estimated time in a phase, the phase end date must be at least today (allowing minimum 1 day for estimates).

**Auto-adjustment:**
- If phase end date < today AND phase has estimated hours > 0
- Move phase end date forward to today (minimum)
- Update database automatically

### Rule 3: Minimum Phase Duration  
**Statement:** A phase with estimated time must have a duration of at least 1 day to accommodate those hours.

**Validation:**
- Phase end date must be >= phase start date
- If estimated hours > 0, there must be at least 1 working day in the phase date range

### Rule 4: Phase Spacing
**Statement:** There must be at least 1 day between a phase end marker and the next phase start (unless it's the last phase).

**Cascading behavior:**
- If Phase 1 ends Dec 21, Phase 2 must start Dec 22 or later
- When a phase end date moves forward and comes within 1 day of next phase start
- Next phase automatically shifts forward to maintain 1-day gap

### Rule 5: Project End Date Extension
**Statement:** When phases are adjusted forward, the project end date must extend to accommodate the new final phase end date.

**Auto-adjustment:**
- Project end date = MAX(current project end date, last phase end date + 1 day buffer)
- Update database automatically

### Rule 6: Creation Validation
**Statement:** A project with estimated time cannot be created fully in the past.

**Validation:**
- At creation time, verify at least one phase/project end date is >= today
- If all dates are in past and estimated hours > 0, reject creation

## Implementation Location

Following **AI Dev Rules**:
- **Domain Rules:** `/domain/rules/ProjectRules.ts` and `/domain/rules/MilestoneRules.ts`
- **Auto-adjustment Logic:** Inline in orchestrators (`ProjectOrchestrator.ts`)
- **Calculation Updates:** `/services/calculations/projects/dayEstimateCalculations.ts`

## Existing Logic to Review/Replace

### Current Milestone Date Validation
**Location:** `src/domain/rules/MilestoneRules.ts`
- `validateMilestoneDateWithinProject()` - Currently checks milestone date <= project end date
- **Action:** Update to enforce minimum future date rule for phases with estimated time

**Location:** `src/domain/rules/RelationshipRules.ts`
- `validateMilestoneBelongsToProject()` - Validates milestone dates within project range
- **Action:** Add phase-specific rules for estimated time validation

### Current Day Estimate Calculations
**Location:** `src/services/calculations/projects/dayEstimateCalculations.ts`
- `calculateMilestoneDayEstimates()` - Currently distributes hours across all working days in date range
- **Action:** Filter out past days, only distribute to today + future

**Location:** `src/services/calculations/projects/dayEstimateCalculations.ts` (line 430-461)
- Auto-estimate fallback for projects without milestones
- **Action:** Apply same past-filtering logic

### Current Project Date Validation
**Location:** `src/domain/rules/ProjectRules.ts`
- `validateProjectDates()` - Validates start < end for time-limited projects
- **Action:** Add validation for projects with estimated time not being fully in past

## New Domain Rule Methods to Add

### In `ProjectRules.ts`:

```typescript
/**
 * RULE: Projects with estimated time cannot be fully in the past
 * At least one working day must be today or in the future
 */
static validateProjectNotFullyInPast(
  project: Project,
  today: Date = new Date()
): { isValid: boolean; errors: string[] }

/**
 * AUTO-ADJUST: Calculate minimum required project end date
 * Based on phases with estimated time
 */
static calculateMinimumProjectEndDate(
  phases: Milestone[],
  today: Date = new Date()
): Date

/**
 * AUTO-ADJUST: Extend project end date if phases require it
 */
static adjustProjectEndDateForPhases(
  project: Project,
  phases: Milestone[],
  today: Date = new Date()
): Date
```

### In `MilestoneRules.ts`:

```typescript
/**
 * RULE: Phase with estimated time must have end date >= today
 */
static validatePhaseEndDateNotInPast(
  phase: Milestone,
  today: Date = new Date()
): { isValid: boolean; errors: string[] }

/**
 * AUTO-ADJUST: Calculate minimum phase end date
 * Ensures at least 1 day for estimated time
 */
static calculateMinimumPhaseEndDate(
  phase: Milestone,
  today: Date = new Date()
): Date

/**
 * AUTO-ADJUST: Cascade phase dates forward when one phase moves
 */
static cascadePhaseAdjustments(
  phases: Milestone[],
  adjustedPhaseIndex: number
): Milestone[]

/**
 * RULE: Validate 1-day spacing between phases
 */
static validatePhaseSpacing(
  phases: Milestone[]
): { isValid: boolean; errors: string[] }
```

## Integration Points

### Project Creation (`ProjectOrchestrator.executeProjectCreationWorkflow`)
1. Validate phases not fully in past (if estimated time > 0)
2. Auto-adjust phase end dates if needed
3. Cascade adjustments to subsequent phases
4. Extend project end date if needed
5. Save adjusted dates to database

### Phase/Milestone Updates
1. When phase end date changes, check if it comes within 1 day of next phase
2. Cascade forward if needed
3. Update project end date if needed

### Timeline Rendering (`dayEstimateCalculations.ts`)
1. Filter working days to only include today + future
2. Recalculate auto-estimates based on filtered days
3. Display warnings if project/phases are in past with remaining estimated time

## Competing Logic to Remove Later

After implementation, review and remove/deprecate:
1. Old milestone date validation that doesn't account for past/future split
2. Any hardcoded "milestone must be within project dates" that conflicts with auto-extension
3. Day estimate calculations that include past days

## Testing Scenarios

1. **Create project fully in past with estimated time** → Should fail validation
2. **Create project partially in past** → Should auto-adjust phase/project end dates
3. **Update phase end date to past** → Should auto-adjust to today minimum
4. **Move phase forward close to next phase** → Should cascade next phase forward
5. **Timeline rendering with past dates** → Should only show estimates on today + future

## Questions/Decisions Needed

- [ ] Should we show UI warnings when dates are auto-adjusted?
- [ ] Should there be a "grace period" for dates (e.g., end of today vs. start of tomorrow)?
- [ ] How to handle continuous projects (no end date) with phases?
- [ ] Should auto-adjustments trigger audit logs?

---

**Next Steps:**
1. Implement domain rule methods in `ProjectRules.ts` and `MilestoneRules.ts`
2. Update orchestrator validation logic
3. Update day estimate calculations to filter past days
4. Add tests for new rules
5. Document competing logic for future removal
