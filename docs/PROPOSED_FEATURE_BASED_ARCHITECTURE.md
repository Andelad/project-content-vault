# Proposed Feature-Based Architecture Refactoring

## Overview

Refactor the current component structure from a mixed view/component organization to a clear feature-based architecture that scales better and provides clearer separation of concerns.

## Proposed Structure

```
src/
├── pages/                          # Top-level route pages only
│   ├── Auth.tsx
│   ├── Index.tsx
│   ├── LandingPage.tsx
│   └── NotFound.tsx
│
├── features/                       # Feature modules (page + components)
│   ├── planner/
│   │   ├── PlannerView.tsx        # Main page component
│   │   ├── components/
│   │   │   ├── PlannerToolbar.tsx
│   │   │   ├── LayersPopover.tsx
│   │   │   ├── EstimatedTimeCard.tsx
│   │   │   ├── HoverablePlannerDateCell.tsx
│   │   │   ├── PlannerInsightCard.tsx
│   │   │   └── WeekNavigationBar.tsx
│   │   ├── hooks/
│   │   └── fullcalendar-overrides.css
│   │
│   ├── timeline/
│   │   ├── TimelineView.tsx
│   │   ├── components/
│   │   │   ├── TimelineToolbar.tsx
│   │   │   ├── TimelineCard.tsx
│   │   │   ├── HoverableDateCell.tsx
│   │   │   ├── ProjectBar.tsx
│   │   │   ├── HolidayBar.tsx
│   │   │   ├── TimelineBackground.tsx
│   │   │   ├── TimelineColumnMarkers.tsx
│   │   │   └── TimelineDateHeader.tsx
│   │   └── hooks/
│   │
│   ├── overview/
│   │   ├── OverviewView.tsx
│   │   └── components/
│   │       ├── ClientsTab.tsx
│   │       ├── HolidaysTab.tsx
│   │       └── ProjectsTab.tsx
│   │
│   ├── insights/
│   │   ├── InsightsView.tsx
│   │   └── components/
│   │       ├── AverageDayHeatmap.tsx
│   │       ├── AverageDayHeatmapCard.tsx
│   │       ├── AverageDayHeatmapCard.simple.tsx
│   │       ├── FilterModal.tsx
│   │       ├── FutureCommitmentsCard.tsx
│   │       ├── InsightsActiveProjectsCard.tsx
│   │       ├── ProjectsDetailView.tsx
│   │       └── TimeAnalysisChart.tsx
│   │
│   ├── projects/
│   │   ├── ProjectsView.tsx
│   │   ├── components/
│   │   │   ├── bar/
│   │   │   │   ├── ProjectIconIndicator.tsx
│   │   │   │   └── ProjectMilestones.tsx
│   │   │   └── sections/
│   │   │       ├── AutoEstimateDaysSection.tsx
│   │   │       ├── ProjectInsightsSection.tsx
│   │   │       ├── ProjectMilestoneSection.tsx
│   │   │       ├── ProjectNotesSection.tsx
│   │   │       └── ProjectProgressGraph.tsx
│   │   └── modals/
│   │       └── ProjectModal.tsx
│   │
│   ├── settings/
│   │   ├── SettingsView.tsx
│   │   └── components/
│   │       ├── CalendarImport.tsx
│   │       └── PWASettings.tsx
│   │
│   ├── profile/
│   │   └── ProfileView.tsx
│   │
│   └── tracker/                    # Time tracking feature
│       ├── components/
│       │   ├── TimeTracker.tsx
│       │   ├── TimeTrackerBookmark.tsx
│       │   └── ConflictDialog.tsx
│       └── hooks/
│
├── components/                     # Shared/reusable components
│   ├── modals/                     # Shared modals
│   │   ├── EventModal.tsx
│   │   ├── ClientModal.tsx
│   │   ├── HolidayModal.tsx
│   │   ├── WorkSlotModal.tsx
│   │   ├── AvailabilityCardModal.tsx
│   │   ├── FeedbackModal.tsx
│   │   ├── HelpModal.tsx
│   │   └── StandardModal.tsx
│   │
│   ├── dialogs/                    # Confirmation/alert dialogs
│   │   ├── RecurringDeleteDialog.tsx
│   │   └── RecurringUpdateDialog.tsx
│   │
│   ├── layout/                     # Layout components
│   │   └── ...
│   │
│   ├── ui/                         # Design system primitives
│   │   └── ...
│   │
│   ├── shared/                     # Cross-feature components
│   │   └── ...
│   │
│   └── debug/
│       └── ...
```

## Migration Path

### Phase 1: Create Structure
1. Create `/src/features/` directory
2. Create subdirectories for each feature

### Phase 2: Move Feature Files
For each feature (planner, timeline, overview, insights, projects, settings, profile, tracker):

1. Move `[Feature]View.tsx` from `/src/components/views/` to `/src/features/[feature]/`
2. Create `/src/features/[feature]/components/` directory
3. Move feature-specific components to the new location
4. Update all import paths

### Phase 3: Update Imports
1. Update imports in moved components
2. Update imports in consuming files
3. Update barrel exports (`index.ts` files)

### Phase 4: Clean Up
1. Remove empty directories
2. Update documentation
3. Verify build and tests

## Key Principles

### What Goes in `/features/[feature]/`?
- The main view/page component
- Components used ONLY by this feature
- Feature-specific hooks
- Feature-specific utilities
- Feature-specific types (if not shared)
- Feature-specific styles

### What Stays in `/components/`?
- Components used by 2+ features
- Design system primitives (buttons, inputs, cards)
- Layout components (navigation, sidebar, header)
- Reusable modal templates
- Reusable dialog patterns

### Decision Framework
Ask: "Is this component likely to be used by another feature?"
- **Yes** → `/components/`
- **No** → `/features/[feature]/components/`
- **Maybe** → Start in feature, move to shared when second use case appears

## Benefits

1. **Clear Feature Ownership**: Everything related to planner lives in `features/planner/`
2. **Easier Navigation**: "Where's the planner toolbar?" → `features/planner/components/`
3. **Better Scalability**: Each feature can grow independently
4. **Reduced Coupling**: Features are more self-contained
5. **Clearer Boundaries**: Easy to distinguish shared vs. feature-specific code
6. **Better Code Splitting**: Natural boundaries for lazy loading
7. **Team Scalability**: Different teams can own different features
8. **Easier Testing**: Test features in isolation
9. **Simpler Mental Model**: Feature-first thinking vs. technical-first

## Current Issues Addressed

1. **Inconsistent Organization**: Timeline in `/components/timeline`, but Planner split between `/components/views/` and `/components/planner`
2. **Unclear Hierarchy**: Hard to distinguish between pages, page-specific components, and reusable templates
3. **Navigation Difficulty**: Need to search multiple locations to find related components
4. **Import Confusion**: Unclear whether to import from `/components/` or `/views/`

## Impact Assessment

### Files to Move
- ~7 main view components
- ~30-40 feature-specific components
- Associated hooks, styles, and utilities

### Import Updates Required
- View components: ~7 files
- Feature components: ~30-40 files
- Consumer files: Estimate 50-100 import statements

### Risk Level
**Medium** - Large number of files, but straightforward mechanical changes

### Estimated Effort
- Structure creation: 30 minutes
- File moves: 2-3 hours
- Import updates: 3-4 hours
- Testing and verification: 2-3 hours
- **Total: 8-11 hours** (1-2 days)

## Rollback Plan

If issues arise:
1. Git provides full history
2. Can revert commits incrementally
3. Can pause mid-refactor and complete later (feature by feature)

## Future Enhancements

Once structure is in place, each feature directory can optionally include:
- `/hooks/` - Feature-specific hooks
- `/utils/` - Feature-specific utilities
- `/types/` - Feature-specific types
- `/constants/` - Feature-specific constants
- `/services/` - Feature-specific services
- `/tests/` - Feature-specific tests

This allows features to be truly self-contained modules.
