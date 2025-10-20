# Timeline Rules Implementation Guide

**Status**: Domain Rules Established ✅  
**Date**: October 20, 2025  
**Next Steps**: Implement in calculations layer

---

## What We've Established

### 1. Business Logic Documentation ✅

**Location**: `docs/BUSINESS_LOGIC_REFERENCE.md` - Rule 9

**Added**: Comprehensive documentation of timeline day estimate rules including:
- Three types of time (Planned, Completed, Auto-Estimate)
- Event project filtering requirements
- Priority and blocking logic
- Visual styling specifications
- Mixed day handling rules

---

### 2. Domain Rules Implementation ✅

**Location**: `src/domain/rules/TimelineRules.ts`

**Created**: Complete domain rule class with:
- Event project filtering (`isEventForProject`)
- Event type classification (`isPlannedTime`, `isCompletedTime`)
- Auto-estimate blocking logic (`shouldShowAutoEstimate`)
- Day time breakdown calculations (`calculateDayTimeBreakdown`)
- Visual styling rules (`getVisualStyling`)
- Helper methods for grouping and validation

**Exported**: Added to `src/domain/rules/index.ts`

---

## The Three Types of Time (Established Rules)

### 1. Planned Time
**Visual**: Lighter color with dashed border

**Business Rule**:
```typescript
TimelineRules.isPlannedTime(event)
// Returns true if:
// - event.completed === false
// - AND event.type !== 'tracked'
// - AND event.type !== 'completed'
```

**Purpose**: Shows user's intended future work

---

### 2. Completed/Tracked Time
**Visual**: Darker solid color

**Business Rule**:
```typescript
TimelineRules.isCompletedTime(event)
// Returns true if:
// - event.completed === true
// - OR event.type === 'tracked'
// - OR event.type === 'completed'
```

**Purpose**: Shows actual work done

---

### 3. Auto-Estimate Time
**Visual**: Lightest color, no border

**Business Rule**:
```typescript
TimelineRules.shouldShowAutoEstimate(eventsOnDay)
// Returns true if:
// - eventsOnDay.length === 0
// (No events at all on this day for this project)
```

**Purpose**: Shows work needed to meet deadline

---

## Critical Rules

### Rule 1: Event Project Filtering
**Every event MUST be filtered by projectId**

```typescript
TimelineRules.isEventForProject(event, project)
// event.projectId === project.id
```

Events not linked to a project do NOT contribute to any project's day estimates.

---

### Rule 2: Auto-Estimate Blocking
**Auto-estimates ONLY appear on days WITHOUT any events**

```typescript
// If day has events (planned OR completed)
IF eventsOnDay.length > 0 THEN
  Show event-based time
  DO NOT show auto-estimate
ELSE
  Show auto-estimate
END IF
```

Both planned AND completed events block auto-estimates.

---

### Rule 3: Mixed Day Handling
**Days with both planned AND completed events**

Current: Show as planned time (lighter with dashed border)
Future: Stack planned on top of completed (not yet implemented)

---

## Current Implementation Status

### ✅ Completed:
1. Business logic documented in BUSINESS_LOGIC_REFERENCE.md
2. Domain rules implemented in TimelineRules.ts
3. Single source of truth established
4. Exported from domain layer

### 🔄 Next Steps:
1. Update `dayEstimateCalculations.ts` to use TimelineRules
2. Separate planned vs completed event estimates
3. Update DayEstimate type to support multiple sources
4. Update TimelineBar rendering to use domain rules
5. Add tests for TimelineRules
6. Remove console.log debug statements

---

## Implementation Plan

### Phase 1: Update Day Estimate Calculations
**File**: `src/services/calculations/dayEstimateCalculations.ts`

**Changes Needed**:
```typescript
import { TimelineRules } from '@/domain/rules';

// Separate planned and completed events
const plannedEvents = events.filter(e => 
  TimelineRules.isEventForProject(e, project) &&
  TimelineRules.isPlannedTime(e)
);

const completedEvents = events.filter(e =>
  TimelineRules.isEventForProject(e, project) &&
  TimelineRules.isCompletedTime(e)
);

// Check if day should show auto-estimates
const eventsOnDay = events.filter(e => 
  TimelineRules.isEventForProject(e, project) &&
  TimelineRules.isSameDay(TimelineRules.getEventDate(e), currentDay)
);

const shouldShowAutoEstimate = TimelineRules.shouldShowAutoEstimate(eventsOnDay);
```

---

### Phase 2: Update DayEstimate Type
**File**: `src/types/core.ts`

**Consider Adding**:
```typescript
export interface DayEstimate {
  date: Date;
  projectId: string;
  hours: number;
  source: 'planned-event' | 'completed-event' | 'milestone-allocation' | 'project-auto-estimate';
  milestoneId?: string;
  isWorkingDay: boolean;
}
```

Note: May need to add `'completed-event'` as a source type.

---

### Phase 3: Update TimelineBar Rendering
**File**: `src/components/timeline/TimelineBar.tsx`

**Changes Needed**:
- Use TimelineRules for event classification
- Render different styles based on DayEstimate.source
- Remove manual event.completed checks (delegate to domain)

---

### Phase 4: Testing
- Unit tests for TimelineRules
- Integration tests for day estimate calculations
- Visual regression tests for timeline rendering

---

## Benefits of This Approach

### ✅ Single Source of Truth
All timeline logic is now documented and centralized in domain layer.

### ✅ Maintainability
Future changes only need to update domain rules, not scattered logic.

### ✅ Testability
Pure functions in domain layer are easy to test in isolation.

### ✅ Documentation
Business rules are self-documenting code + comprehensive docs.

### ✅ AI Development
AI can reference domain rules for all timeline-related features.

---

## Questions for Next Implementation Phase

1. **DayEstimate Type**: Should we add `'completed-event'` as a source type?
   - Current: Only `'planned-event'` exists
   - Proposed: Add `'completed-event'` to distinguish

2. **Stacking Logic**: When should we implement stacking of planned + completed?
   - Current: Show as planned if both exist
   - Future: Visual stacking (planned on top of completed)

3. **Color Calculations**: Should color intensity be in domain rules?
   - Current: Colors defined in TimelineBar component
   - Consider: Move to domain as business rules

---

## References

- **Business Logic**: `docs/BUSINESS_LOGIC_REFERENCE.md` - Rule 9
- **Domain Rules**: `src/domain/rules/TimelineRules.ts`
- **Current Implementation**: `src/services/calculations/dayEstimateCalculations.ts`
- **Rendering**: `src/components/timeline/TimelineBar.tsx`

---

**Created**: October 20, 2025  
**Author**: AI Development Assistant  
**Status**: Domain Layer Complete - Ready for Implementation Phase
