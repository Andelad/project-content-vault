# Domain Rules Index

**Quick reference for finding business rules and calculations**

Last Updated: January 8, 2026

## How to Use This Index

When fixing a bug or adding a feature, use this index to find the correct domain rule file quickly. Each entry links to the specific file that owns that business logic.

## Rules by Domain Entity

### Projects

| Rule Type | File | Key Functions |
|-----------|------|---------------|
| **Project Validation** | `projects/ProjectValidation.ts` | `validateEstimatedHours()`, `validateDateRange()`, `analyzeBudget()` |
| **Project Metrics** | `projects/ProjectMetrics.ts` | `calculateProjectDuration()`, `getCompletedTimeUpToDate()`, Project progress tracking |
| **Project Budget** | `projects/ProjectBudget.ts` | `calculateAutoEstimateWorkingDays()`, `calculateAutoEstimateHoursPerDay()` |
| **Project Integrity** | `projects/ProjectIntegrity.ts` | `validateProjectReferences()`, `findOrphanedProjects()` |
| **Project Deletion Impact** | `projects/ProjectDeletionImpact.ts` | `analyzeProjectDeletion()`, `formatImpactMessage()` |
| **Day Estimates** | `projects/DayEstimate.ts` | `calculateProjectDayEstimates()`, `isWorkingDayForEstimates()` |

### Phases (Milestones)

| Rule Type | File | Key Functions |
|-----------|------|---------------|
| **Phase Validation** | `phases/PhaseValidation.ts` | `validateMilestoneDateWithinProject()`, `validateMilestoneDateRange()`, `validatePhaseSpacing()` |
| **Phase Calculations** | `phases/PhaseCalculations.ts` | `calculateTotalAllocation()`, `calculateBudgetUtilization()`, `validateMilestoneScheduling()` |
| **Phase Hierarchy** | `phases/PhaseHierarchy.ts` | Sequencing, continuity, splitting logic |
| **Phase Recurrence** | `phases/PhaseRecurrence.ts` | Recurring phase generation, RRule handling |
| **Phase Distribution** | `phases/PhaseDistribution.ts` | Distribution algorithms across dates |
| **Phase Integrity** | `phases/PhaseIntegrity.ts` | `validatePhaseBelongsToProject()`, `findOrphanedPhases()` |
| **Phase Rules (Barrel)** | `phases/PhaseRules.ts` | Re-exports all phase rules for backward compatibility |

### Events

| Rule Type | File | Key Functions |
|-----------|------|---------------|
| **Event Validation** | `events/EventValidation.ts` | `validateEventTitle()`, `validateEventTimeRange()`, `validateProjectLinking()` |
| **Event Classification** | `events/EventClassification.ts` | `isPlannedTime()`, `isCompletedTime()`, `classifyEvent()` |
| **Event Calculations** | `events/EventCalculations.ts` | `calculateEventDurationOnDate()`, `calculateRecurringEventsNeeded()`, `calculateDayDifference()` |
| **Event Splitting** | `events/EventSplitting.ts` | `processEventOverlaps()`, Time tracking overlap handling |

### Time Tracking

| Rule Type | File | Key Functions |
|-----------|------|---------------|
| **Time Tracking Calculations** | `time-tracking/TimeTrackingCalculations.ts` | `calculateDuration()`, `calculateElapsedSeconds()`, `validateTimeSegment()` |
| **Time Tracker Helpers** | `time-tracking/TimeTrackerHelpers.ts` | `handlePlannedEventOverlaps()`, `filterSearchResults()`, `createTrackingEventData()` |

### Holidays

| Rule Type | File | Key Functions |
|-----------|------|---------------|
| **Holiday Calculations** | `holidays/HolidayCalculations.ts` | `expandHolidayDates()`, `isHolidayDate()`, `validateHolidayPlacement()` |

### Clients & Groups

| Rule Type | File | Key Functions |
|-----------|------|---------------|
| **Client Validation** | `clients/ClientValidation.ts` | `validateClientName()`, `validateClientUpdate()` |
| **Label Validation** | `clients/LabelValidation.ts` | Label-specific validation rules |
| **Client Deletion Impact** | `clients/ClientDeletionImpact.ts` | `analyzeClientDeletion()`, `formatImpactMessage()` |
| **Group Validation** | `groups/GroupValidation.ts` | `validateGroupName()`, `isSystemGroup()` |
| **Group Calculations** | `groups/GroupCalculations.ts` | Group statistics and metrics |
| **Group Deletion Impact** | `groups/GroupDeletionImpact.ts` | `analyzeGroupDeletion()`, `formatImpactMessage()` |

### Work Hours & Capacity

| Rule Type | File | Key Functions |
|-----------|------|---------------|
| **Work Hour Generation** | `availability/WorkHourGeneration.ts` | `generateWorkHoursForDate()`, `calculateWorkHoursTotal()` |
| **Capacity Analysis** | `availability/CapacityAnalysis.ts` | `calculateWorkHourCapacity()`, Overbooking detection |
| **Daily Metrics** | `availability/DailyMetrics.ts` | `getWorkHoursForDay()`, `calculateDailyProjectHours()` |
| **Work Slot Validation** | `work-slots/WorkSlotValidation.ts` | Work slot validation rules |

## Cross-Cutting Concerns

### Project-Phase Synchronization

**File:** `ProjectPhaseSync.ts` (root level - shared between projects & phases)

| Concern | Class | Key Methods | Purpose |
|---------|-------|-------------|---------|
| **Date Sync** | `DateSync` | `synchronizeProjectWithPhases()`, `validatePhasesWithinProject()` | Keeps project dates aligned with phase dates (bi-directional) |
| **Budget Sync** | `BudgetSync` | `analyzeBudget()`, `canAccommodateAdditionalHours()` | Ensures phase budgets don't exceed project budget |

**Usage:**
```typescript
import { DateSync, BudgetSync } from '@/domain/rules/ProjectPhaseSync';
```

### System Integrity

**File:** `SystemIntegrity.ts` (root level - orchestrates entity-specific integrity)

| Concern | Class | Key Methods | Purpose |
|---------|-------|-------------|---------|
| **System Validation** | `SystemIntegrity` | `validateSystemIntegrity()` | Validates all foreign keys & constraints across entire system |

**Usage:**
```typescript
import { SystemIntegrity } from '@/domain/rules/SystemIntegrity';

const result = SystemIntegrity.validateSystemIntegrity({
  projects, phases, clients, groups
});
```

**Entity-Specific Integrity:**
- `phases/PhaseIntegrity.ts` - Phase → Project validation
- `projects/ProjectIntegrity.ts` - Project → Client/Group validation

### Deletion Impact Analysis

**Entity-Specific Files:**
- `projects/ProjectDeletionImpact.ts` - Preview what gets deleted with a project
- `clients/ClientDeletionImpact.ts` - Preview cascade from client deletion
- `groups/GroupDeletionImpact.ts` - Preview cascade from group deletion

### View-Specific Rules

| View | File | Purpose |
|------|------|---------|
| **Timeline Display** | `timeline/TimelineDisplay.ts` | Timeline View display constraints (mutual exclusivity) |
| **Timeline Row Calculations** | `timeline/TimelineRowCalculations.ts` | Row-specific calculations for timeline rendering |

## Common Calculations Reference

### Working Day Determination

**Canonical Source:** `utils/dateCalculations.ts`

```typescript
import { isWorkingDay } from '@/utils/dateCalculations';
```

**When to use domain-specific variants:**
- `HolidayCalculations.isWorkingDay()` - Deprecated, delegates to utils
- `ProjectBudget.isWorkingDay()` - Project-specific (checks weeklyWorkHours config)
- `DayEstimate.isWorkingDayForEstimates()` - Estimation-specific (checks autoEstimateDays)
- `WorkSlotValidation.isWorkingDay()` - Work-slot-specific (checks if slots exist)

### Duration Calculations

**Canonical Source:** `utils/dateCalculations.ts`

```typescript
import { 
  calculateDurationHours,
  calculateDurationMinutes,
  calculateDurationDays
} from '@/utils/dateCalculations';
```

**Domain-specific wrappers (all delegate to utils):**
- `TimeTrackingCalculations.calculateDurationHours()` - Exposes helper for orchestrators
- `EventClassification.calculateEventHours()` - Deprecated, use utils directly
- `ProjectMetrics.calculateEventDurationHours()` - Project-specific convenience wrapper

### Budget Calculations

**Canonical Source:** `domain/rules/phases/PhaseCalculations.ts`

```typescript
import { 
  calculateTotalAllocation,
  calculateBudgetUtilization,
  calculateRemainingBudget
} from '@/domain/rules/phases/PhaseCalculations';
```

**Re-exports for compatibility:**
- `PhaseRules.calculateTotalAllocation()` - Re-exports PhaseCalculations
- `BudgetSync.calculateTotalAllocation()` - Re-exports PhaseCalculations (from ProjectPhaseSync.ts)

### Event Duration on Specific Dates

**Canonical Source:** `domain/rules/events/EventCalculations.ts`

```typescript
import { calculateEventDurationOnDate } from '@/domain/rules/events/EventCalculations';
```

Handles multi-day events and calculates duration for a specific date.

## Finding Rules by Business Concept

| I need to... | Look in... |
|--------------|-----------|
| Validate phase dates fall within project | `phases/PhaseValidation.ts` → `validateMilestoneDateWithinProject()` |
| Calculate if budget is exceeded | `phases/PhaseCalculations.ts` → `calculateBudgetUtilization()` |
| Check if a date is a working day | `utils/dateCalculations.ts` → `isWorkingDay()` |
| Calculate event duration for a specific date | `events/EventCalculations.ts` → `calculateEventDurationOnDate()` |
| Classify event as planned vs completed | `events/EventClassification.ts` → `classifyEvent()` |
| Validate holiday placement | `holidays/HolidayCalculations.ts` → `validateHolidayPlacement()` |
| Handle time tracking overlaps | `time-tracking/TimeTrackerHelpers.ts` → `handlePlannedEventOverlaps()` |
| Generate recurring phases | `phases/PhaseRecurrence.ts` → `PhaseRecurrenceService` |
| Detect orphaned entities | `integrity/EntityIntegrity.ts` → Foreign key validation methods |
| Synchronize project and phase dates | `sync/DateSync.ts` → `synchronizeProjectWithPhases()` |

## Architecture Notes

### File Naming Convention

- **`{Entity}Validation.ts`** - Business rule validation (dates, constraints, invariants)
- **`{Entity}Calculations.ts`** - Pure calculations (budget, metrics, aggregations)  
- **`{Entity}Rules.ts`** - Re-export barrel for backward compatibility

### Import Guidelines

1. **Prefer direct imports** from specific files over barrel imports
2. **Use utils for pure math** - Duration, date calculations belong in `utils/dateCalculations.ts`
3. **Domain-specific logic stays in domain** - Project-specific working day checks belong in `projects/`
4. **Avoid circular dependencies** - Use type imports when needed

### Single Sources of Truth

| Concept | Authoritative Implementation |
|---------|------------------------------|
| Working Day (General) | `utils/dateCalculations.isWorkingDay()` |
| Duration Calculations | `utils/dateCalculations.calculate*()` |
| Budget Total Allocation | `phases/PhaseCalculations.calculateTotalAllocation()` |
| Event Duration on Date | `events/EventCalculations.calculateEventDurationOnDate()` |
| Holiday Validation | `holidays/HolidayCalculations.validateHolidayPlacement()` |

## Migration Notes

### Recently Consolidated (January 2026)

- ✅ `isWorkingDay` - Consolidated to `utils/dateCalculations.ts`
- ✅ `calculateTotalAllocation` - Consolidated to `phases/PhaseCalculations.ts`
- ✅ Event duration calculations - Consolidated to `events/EventCalculations.ts`
- ✅ File rename: `PhaseBudget.ts` → `PhaseCalculations.ts`

### Deprecated Imports

```typescript
// ❌ Don't use
import { calculateTotalAllocation } from '@/domain/rules/sync/BudgetSync';

// ✅ Use instead
import { calculateTotalAllocation } from '@/domain/rules/phases/PhaseCalculations';
```

## Adding New Rules

When adding a new business rule:

1. **Choose the correct file** using the naming convention above
2. **Add KEYWORDS** to the file header (see `DailyMetrics.ts` for example)
3. **Update this index** with the new rule location
4. **Check for duplicates** - Search codebase before implementing
5. **Delegate to utils** for pure math operations

## Related Documentation

- [Architecture Rebuild Plan](../../docs/operations/ARCHITECTURE_REBUILD_PLAN.md)
- [Domain Rules Consolidation](../../docs/operations/DOMAIN_RULES_CONSOLIDATION.md)
- [Business Logic Reference](../../docs/core/Business Logic.md)
