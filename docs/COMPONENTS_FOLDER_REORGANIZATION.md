# Components Folder Reorganization Plan

## Current Structure Issues

### Problem 1: Mixed Abstraction Levels
```
components/
├── ui/              # Design system primitives (buttons, inputs)
├── shared/          # Mid-level components (cards, layouts)
├── layout/          # App-level layout components
├── modals/          # Shared modals
├── dialog/          # Just 2 dialog components
├── planner/         # Feature-specific components
├── timeline/        # Feature-specific components
├── projects/        # Feature-specific components
├── settings/        # Feature-specific components
├── insights/        # Feature-specific components
├── tracker/         # Feature-specific components
└── views/           # View components + some sub-components
```

**Issue:** Hard to distinguish between:
- Reusable design system components (ui)
- Shared business components (modals, layouts)
- Feature-specific components (planner, timeline, etc.)
- Where to put new components?

### Problem 2: `dialog/` vs `modals/`
- `dialog/`: RecurringDeleteDialog, RecurringUpdateDialog (confirmation dialogs)
- `modals/`: EventModal, ProjectModal, ClientModal, etc. (full modals)

**Confusion:** What's the difference? When do I use which folder?

### Problem 3: Feature-Specific in `/components`
Why are these in `/components`?
- `planner/` - Only used by PlannerView
- `timeline/` - Only used by TimelineView
- `projects/` - Only used by ProjectsView
- `settings/` - Only used by SettingsView
- `insights/` - Only used by InsightsView
- `tracker/` - Used across multiple views (valid shared)

### Problem 4: `views/` Contains Both
```
views/
├── PlannerView.tsx           # Main view component
├── TimelineView.tsx          # Main view component
├── planner/                  # Planner sub-components
│   ├── LayersPopover.tsx
│   └── PlannerToolbar.tsx
└── overview/                 # Overview sub-components
    ├── ClientsTab.tsx
    └── ...
```

**Issue:** Some features have components in both `/components/[feature]` AND `/components/views/[feature]`

---

## Recommended Structure (Components Folder Only)

### Option A: Clear Hierarchy by Abstraction Level (RECOMMENDED)

```
components/
├── primitives/              # Previously "ui" - Design system atoms
│   ├── button.tsx
│   ├── input.tsx
│   ├── card.tsx
│   └── ... (all shadcn/ui components)
│
├── widgets/                 # Complex shared components (molecules/organisms)
│   ├── tracker/            # Time tracker (used across features)
│   │   ├── TimeTracker.tsx
│   │   ├── TimeTrackerBookmark.tsx
│   │   └── ConflictDialog.tsx
│   │
│   ├── AvailabilityCard.tsx
│   ├── DatePickerButton.tsx
│   ├── ProjectSearchInput.tsx
│   └── TabComponent.tsx
│
├── layout/                  # App structure components
│   ├── AppHeader.tsx
│   ├── MainAppLayout.tsx
│   ├── Sidebar.tsx
│   ├── AppPageLayout.tsx
│   ├── SidebarLayout.tsx
│   └── CardSidebarLayout.tsx
│
├── modals/                  # All modal dialogs (full-screen overlays)
│   ├── EventModal.tsx
│   ├── ProjectModal.tsx
│   ├── ClientModal.tsx
│   ├── HolidayModal.tsx
│   ├── WorkSlotModal.tsx
│   ├── AvailabilityCardModal.tsx
│   ├── FeedbackModal.tsx
│   ├── HelpModal.tsx
│   └── StandardModal.tsx
│
├── dialogs/                 # Confirmation/alert dialogs (small overlays)
│   ├── RecurringDeleteDialog.tsx
│   └── RecurringUpdateDialog.tsx
│
├── views/                   # View components (one per route/page)
│   ├── planner/
│   │   ├── PlannerView.tsx
│   │   ├── PlannerToolbar.tsx
│   │   ├── LayersPopover.tsx
│   │   ├── EstimatedTimeCard.tsx
│   │   ├── HoverablePlannerDateCell.tsx
│   │   ├── PlannerInsightCard.tsx
│   │   ├── WeekNavigationBar.tsx
│   │   └── fullcalendar-overrides.css
│   │
│   ├── timeline/
│   │   ├── TimelineView.tsx
│   │   ├── TimelineToolbar.tsx
│   │   ├── TimelineCard.tsx
│   │   ├── HoverableDateCell.tsx
│   │   ├── ProjectBar.tsx
│   │   ├── HolidayBar.tsx
│   │   ├── TimelineBackground.tsx
│   │   ├── TimelineColumnMarkers.tsx
│   │   └── TimelineDateHeader.tsx
│   │
│   ├── overview/
│   │   ├── OverviewView.tsx
│   │   ├── ClientsTab.tsx
│   │   ├── HolidaysTab.tsx
│   │   └── ProjectsTab.tsx
│   │
│   ├── insights/
│   │   ├── InsightsView.tsx
│   │   ├── AverageDayHeatmap.tsx
│   │   ├── AverageDayHeatmapCard.tsx
│   │   ├── AverageDayHeatmapCard.simple.tsx
│   │   ├── FilterModal.tsx
│   │   ├── FutureCommitmentsCard.tsx
│   │   ├── InsightsActiveProjectsCard.tsx
│   │   ├── ProjectsDetailView.tsx
│   │   └── TimeAnalysisChart.tsx
│   │
│   ├── projects/
│   │   ├── ProjectsView.tsx
│   │   └── components/
│   │       ├── bar/
│   │       │   ├── ProjectIconIndicator.tsx
│   │       │   └── ProjectMilestones.tsx
│   │       └── sections/
│   │           ├── AutoEstimateDaysSection.tsx
│   │           ├── ProjectInsightsSection.tsx
│   │           ├── ProjectMilestoneSection.tsx
│   │           ├── ProjectNotesSection.tsx
│   │           └── ProjectProgressGraph.tsx
│   │
│   ├── settings/
│   │   ├── SettingsView.tsx
│   │   ├── CalendarImport.tsx
│   │   └── PWASettings.tsx
│   │
│   ├── ProfileView.tsx
│   └── index.ts
│
└── dev/                     # Development/debugging tools
    ├── DatabaseTestComponent.tsx
    ├── DebugView.tsx
    ├── DevTools.tsx
    ├── ErrorBoundary.tsx
    ├── OrphanedMilestonesCleaner.tsx
    ├── PerformanceStatus.tsx
    ├── SupabaseConfigError.tsx
    ├── TestContexts.tsx
    ├── TestProjectContext.tsx
    └── ViewErrorFallback.tsx
```

### Naming Convention Clarity

| Folder | Purpose | Import From | Examples |
|--------|---------|-------------|----------|
| `primitives/` | Design system atoms (shadcn/ui) | Use for all basic UI | Button, Input, Card, Dialog |
| `widgets/` | Complex shared components | Multiple features need it | TimeTracker, DatePicker |
| `layout/` | App structure & shells | Wraps pages/views | AppHeader, Sidebar, MainLayout |
| `modals/` | Full-screen overlay dialogs | Need user input/display | EventModal, ProjectModal |
| `dialogs/` | Small confirmation prompts | Yes/No, OK/Cancel | DeleteDialog, ConfirmDialog |
| `views/[feature]/` | Feature page + components | Only this feature | PlannerView + PlannerToolbar |
| `dev/` | Debug & testing tools | Development only | DevTools, ErrorBoundary |

---

## Option B: Simpler - Just Consolidate Views

```
components/
├── ui/                      # Keep as-is (design system)
├── layout/                  # Keep as-is (app shells)
├── modals/                  # Keep as-is + merge dialogs here
├── shared/                  # Keep as-is + merge tracker here
│   ├── tracker/
│   ├── AvailabilityCard.tsx
│   └── ...
│
├── views/                   # Consolidate ALL view-related components
│   ├── planner/
│   │   ├── PlannerView.tsx
│   │   └── [all planner components]
│   ├── timeline/
│   │   ├── TimelineView.tsx
│   │   └── [all timeline components]
│   ├── overview/
│   ├── insights/
│   ├── projects/
│   ├── settings/
│   └── ProfileView.tsx
│
└── debug/                   # Keep as-is
```

**Changes needed:**
1. Move `/components/planner/` → `/components/views/planner/`
2. Move `/components/timeline/` → `/components/views/timeline/`
3. Move `/components/projects/` → `/components/views/projects/`
4. Move `/components/settings/` → `/components/views/settings/`
5. Move `/components/insights/` → `/components/views/insights/`
6. Merge `/components/dialog/` into `/components/modals/`
7. Move `/components/tracker/` into `/components/shared/tracker/`

---

## Comparison

| Aspect | Option A | Option B |
|--------|----------|----------|
| **Clarity** | ⭐⭐⭐⭐⭐ Very clear hierarchy | ⭐⭐⭐ Good enough |
| **Migration Effort** | Medium (rename ui→primitives, debug→dev) | Low (just move 7 folders) |
| **Scalability** | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Good |
| **Learning Curve** | Slightly higher (new conventions) | Lower (familiar pattern) |
| **Future-proof** | Best for growth | Good for current size |

---

## My Recommendation: **Option B for Now**

### Why?
1. **Lower risk** - Fewer renames, less churn
2. **Faster** - Can be done in 2-3 hours
3. **Immediate benefit** - Consolidates scattered feature components
4. **Evolutionary** - Can move to Option A later if needed

### Can Evolve to Option A Later
```
Phase 1 (Now): Option B - Consolidate views
Phase 2 (Later): Rename ui → primitives
Phase 3 (Later): Extract widgets from shared
Phase 4 (Later): Rename debug → dev
```

---

## Migration Steps (Option B)

### Step 1: Consolidate Feature Components → views/
```bash
# Move feature folders into views
src/components/planner/       → src/components/views/planner/
src/components/timeline/      → src/components/views/timeline/
src/components/projects/      → src/components/views/projects/
src/components/settings/      → src/components/views/settings/
src/components/insights/      → src/components/views/insights/
```

### Step 2: Merge dialogs into modals
```bash
src/components/dialog/RecurringDeleteDialog.tsx  → src/components/modals/
src/components/dialog/RecurringUpdateDialog.tsx  → src/components/modals/
# Delete empty dialog/ folder
```

### Step 3: Move tracker to shared
```bash
src/components/tracker/  → src/components/shared/tracker/
```

### Step 4: Update Barrel Exports
Update index.ts files in affected folders

### Step 5: Update Imports
Search and replace import paths (TypeScript will help catch these)

---

## File Count Impact

### Moves Required
- **5 feature folders** (planner, timeline, projects, settings, insights)
- **2 dialog files** (into modals)
- **1 tracker folder** (into shared)
- **Total: ~40-50 files**

### Import Updates
- Feature components: ~40 files
- View components: ~7 files
- Consumer imports: ~50-80 files
- **Total: ~100-130 import statements**

### Time Estimate
- Planning: 30 min ✅ (done now)
- Moving files: 1 hour
- Updating imports: 2-3 hours
- Testing: 1-2 hours
- **Total: 4-6 hours**

---

## Decision Framework for Future

### "Where should I put this new component?"

```
┌─ Is it a shadcn/ui component or design system primitive?
│  └─ YES → /components/ui/
│  
├─ Is it used in 2+ feature views?
│  └─ YES → /components/shared/
│  
├─ Is it a modal dialog?
│  └─ YES → /components/modals/
│  
├─ Is it app structure (header, sidebar, navigation)?
│  └─ YES → /components/layout/
│  
├─ Is it for debugging/development only?
│  └─ YES → /components/debug/
│  
└─ It's feature-specific
   └─ → /components/views/[feature-name]/
```

---

## Benefits of This Reorganization

1. ✅ **All feature components in one place** (`/views/[feature]`)
2. ✅ **Clear distinction** between shared and feature-specific
3. ✅ **Easier onboarding** - predictable structure
4. ✅ **Reduced confusion** - dialogs merged into modals
5. ✅ **Better discoverability** - related code co-located
6. ✅ **Low risk** - straightforward moves, no architectural changes

---

## Next Steps

1. **Get approval** on Option B
2. **Create feature branch** for this refactor
3. **Move one feature first** (proof of concept)
4. **Run tests** and verify
5. **Move remaining features**
6. **Update documentation**
7. **Merge when stable**

Would you like me to start with a proof of concept by moving one feature (e.g., timeline)?
