# Stage 1 Migration Plan: Working Days Consolidation

## 🎯 Priority 1: Working Days Calculation (CRITICAL for UI consistency)

### Current Problem:
- Project bars on weeks/days view use different calculations for width/positioning
- Milestones use different working day logic for deadline calculations  
- Events use different working day logic for conflict detection
- 6+ duplicate implementations with slight variations

### Single Source of Truth Target:
Establish ONE authoritative working days calculation that ALL UI components use.

### Step 1: Audit Current Domain Entities
Check if ProjectEntity or new WorkingDaysEntity should be the authority.

### Step 2: Create Delegation Plan
All 6+ implementations delegate to the chosen domain entity.

### Step 3: Verify UI Consistency  
Test that project bars, milestones, and events now use identical calculations.

## 🔧 Implementation Strategy

### Target Structure:
```
core/domain/WorkingDaysEntity.ts  ← SINGLE SOURCE OF TRUTH
├── calculateWorkingDays(startDate, endDate, settings, holidays)
├── isWorkingDay(date, settings, holidays)  
└── calculateProjectWorkingDays(project, settings, holidays)

All other services delegate:
├── projects/legacy/projectWorkingDaysService.ts → delegation
├── work-hours/legacy/workHourCapacityService.ts → delegation
├── events/eventWorkHourIntegrationService.ts → delegation
├── milestones/legacy/milestoneUtilitiesService.ts → delegation
└── projects/ProjectCalculations.ts → delegation
```

### Benefits:
✅ Project bars use same calculation as milestone timing
✅ Events use same working day logic as projects
✅ Single place to fix bugs or adjust business rules
✅ UI components guaranteed consistent behavior
