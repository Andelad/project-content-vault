# Viewport Calculation Refactoring

## Overview
Extracted viewport calculations from React hooks to centralized `TimelineViewportService` to eliminate duplication, improve maintainability, and follow the established architectural pattern of keeping calculations in services.

## Changes Made

### 1. Enhanced TimelineViewportService (`src/services/timelineViewportService.ts`)

**Added new methods:**
- `calculateDynamicViewportSize()` - Calculates optimal viewport size based on screen space
- `calculateVisibleColumns()` - Determines how many columns can fit in the display
- `generateTimelineData()` - Generates timeline data with project filtering

**Added constants:**
- `MIN_DAY_COLUMN_WIDTH = 40`
- `MIN_WEEK_COLUMN_WIDTH = 77`
- `MIN_VIEWPORT_DAYS = 7`
- `MAX_VIEWPORT_DAYS = 60`
- `MIN_VIEWPORT_WEEKS = 4`
- `MAX_VIEWPORT_WEEKS = 30`
- `SIDEBAR_WIDTH = 280`
- `COLLAPSED_SIDEBAR_WIDTH = 48`
- `VIEWPORT_MARGINS = 100`

### 2. Simplified useDynamicViewportDays (`src/hooks/useDynamicViewportDays.ts`)

**Before:** 95 lines with complex calculation logic
**After:** ~40 lines focused on React state management

**Key changes:**
- Removed all calculation constants and logic
- Now delegates to `TimelineViewportService.calculateDynamicViewportSize()`
- Maintains same public API and behavior
- Preserves performance optimizations (debouncing, resize observers)

### 3. Simplified useTimelineData (`src/hooks/useTimelineData.ts`)

**Before:** 120 lines with duplicated viewport calculations
**After:** ~20 lines focused on React memoization

**Key changes:**
- Removed duplicated viewport sizing logic
- Now delegates to `TimelineViewportService.generateTimelineData()`
- Maintains same return interface
- Preserves debug logging with simplified format

## Benefits

### ✅ Eliminated Code Duplication
- Removed duplicate viewport calculations between hooks
- Single source of truth for viewport logic
- Consistent behavior across components

### ✅ Improved Maintainability
- Calculations now in pure, testable functions
- Clear separation of concerns (hooks = state, services = calculations)
- Easier to debug and modify viewport behavior

### ✅ Better Performance
- Calculations can be more easily cached and optimized
- Reduced memory footprint in React components
- Preserved existing performance optimizations

### ✅ Architectural Consistency
- Follows established pattern: "ALL CALCULATIONS MUST USE THESE SERVICES"
- Aligns with existing service layer structure
- Maintains clean component architecture

## API Compatibility

All hooks maintain their existing public APIs:

```typescript
// useDynamicViewportDays - no changes
const viewportDays = useDynamicViewportDays(sidebarCollapsed, mode);

// useTimelineData - no changes  
const { dates, viewportEnd, filteredProjects } = useTimelineData(
  projects, viewportStart, viewportDays, mode, collapsed
);
```

## Testing

- [x] TypeScript compilation passes
- [x] No breaking changes to hook interfaces
- [x] Service methods are pure functions (easier to test)

## Next Steps

### Priority 2: Work Hours Calculations
- Extract complex week-specific override logic from `useWorkHours`
- Create `WorkHourCalculationService`
- Move business rules and transformations

### Priority 3: Performance Optimization
- Add caching to viewport calculations
- Implement memoization for expensive operations
- Add performance metrics

## Files Modified

1. `src/services/timelineViewportService.ts` - Added viewport calculation methods
2. `src/hooks/useDynamicViewportDays.ts` - Simplified to use service
3. `src/hooks/useTimelineData.ts` - Simplified to use service
4. `docs/development/VIEWPORT_CALCULATION_REFACTORING.md` - This documentation

## Architecture Notes

This refactoring enforces the architectural rule:
> 🚨 ARCHITECTURAL RULE: ALL CALCULATIONS MUST USE THESE SERVICES
> 
> ❌ DON'T add calculations to:
>    - Components (render logic only)
>    - Hooks (state management only) 
>
> ✅ DO add calculations to:
>    - Services (business logic and math)

The hooks now focus purely on:
- React state management
- Event handling  
- Lifecycle management
- Calling calculation services

While services handle:
- Mathematical operations
- Business logic
- Complex algorithms
- Pure transformations
