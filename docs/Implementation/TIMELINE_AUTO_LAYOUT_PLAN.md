# Timeline Auto-Layout Implementation Plan

**Date:** October 28, 2025  
**Status:** 📋 PLANNING  
**Complexity:** HIGH - Major architectural change

---

## Executive Summary

### Current State: Row-Based Timeline
- Groups contain Rows (named, ordered, fixed)
- Projects assigned to specific rows via `rowId`
- Timeline shows all rows even if empty
- Projects are draggable between rows
- "Add Project" hover on rows to create projects

### Target State: Auto-Layout Timeline
- Groups contain Projects directly (no rows)
- Projects auto-arrange by date/name within groups
- Dynamic visual rows created only for concurrent projects
- Minimum 2-day gap between projects on same visual row
- Projects NOT draggable (auto-positioned)
- "Add Project" button opens modal, timeline auto-places

---

## Impact Analysis

### Data Layer Impact: **LOW** ✅
**Good News:** `rowId` is already marked as DEPRECATED and optional in the database!

```typescript
// From core.ts
export interface Project {
  groupId: string;  // REQUIRED: Already migrated
  rowId?: string;   // DEPRECATED: Already optional
}
```

**Database Changes Required:** NONE
- `rowId` field already exists and is nullable
- No migration needed
- Old projects keep their `rowId` (ignored by new UI)
- New projects won't set `rowId` at all

### Code Impact: **HIGH** ⚠️

**Components to Modify:** ~15-20 files
- Core Timeline rendering logic
- Sidebar display
- Project creation flow
- Drag & drop system (remove)
- Row management UI (remove)

**Risk Assessment:**
- High: Breaking existing timeline functionality
- Medium: Performance with dynamic layout calculations
- Low: Data corruption (rowId stays optional)

---

## Test Environment Strategy

### Option 1: Feature Flag (Recommended) ✅
Create a new view mode that can be toggled:

```typescript
// In SettingsContext or TimelineContext
interface TimelineSettings {
  layoutMode: 'legacy-rows' | 'auto-layout';
}
```

**Pros:**
- Can test both modes side-by-side
- Easy rollback if issues arise
- Users can choose during transition
- Keep legacy code as backup

**Cons:**
- Maintain two codebases temporarily
- More complex initial implementation

### Option 2: Separate Timeline View (Alternative)
Create `TimelineAutoLayout.tsx` alongside `Timeline.tsx`

**Pros:**
- Complete isolation
- No risk to existing functionality
- Can develop incrementally

**Cons:**
- Code duplication
- Harder to merge back
- Split user experience

### Option 3: Direct Replacement (Not Recommended)
Replace existing timeline entirely

**Pros:**
- Clean, single codebase
- Force commitment to new design

**Cons:**
- High risk
- No fallback
- All-or-nothing deployment

### **Recommendation: Option 1 (Feature Flag)**

---

## Implementation Plan

### Phase 1: Foundation (No UI Changes Yet)
**Goal:** Build new services without touching existing UI

**Tasks:**
1. Create `TimelineAutoLayoutService.ts`
   - Calculate project overlaps for date range
   - Assign projects to visual rows (2-day minimum gap)
   - Sort by start date or alphabetically
   - Return layout data structure

2. Create layout data types:
```typescript
interface VisualRow {
  rowNumber: number;
  projects: Project[];
  height: number; // ROW_HEIGHT constant
}

interface GroupLayout {
  groupId: string;
  groupName: string;
  visualRows: VisualRow[];
  totalHeight: number;
}

interface TimelineLayout {
  groups: GroupLayout[];
  dateRange: { start: Date; end: Date };
}
```

3. Add feature flag to settings
4. Create unit tests for layout algorithm

**Estimated Time:** 4-6 hours  
**Risk:** Low (no UI changes)

---

### Phase 2: Create New Timeline View
**Goal:** Build parallel auto-layout timeline

**Tasks:**
1. Create `TimelineAutoLayout.tsx` (copy of current Timeline)
2. Add route/view switcher for layout mode
3. Update `DraggableRowComponent` → `AutoLayoutGroupRow`
   - Remove row name
   - Use calculated visual rows
   - Render projects from layout service
4. Update `TimelineSidebar` for auto-layout
   - Show group names only
   - Dynamic height per group
5. Remove drag-and-drop for projects
6. Update "Add Project" to open modal only

**Estimated Time:** 6-8 hours  
**Risk:** Medium (new UI parallel to old)

---

### Phase 3: Integration & Polish
**Goal:** Connect everything and refine

**Tasks:**
1. Wire layout service to timeline context
2. Handle timeline scrolling (recalculate layout on date range change)
3. Optimize performance (memoization, caching)
4. Update project creation flow
   - Remove rowId from new projects
   - Auto-refresh timeline after creation
5. Add loading states during recalculation
6. Test edge cases:
   - Many overlapping projects
   - Very long projects
   - Continuous projects
   - Empty groups

**Estimated Time:** 4-6 hours  
**Risk:** Medium (integration complexity)

---

### Phase 4: Cleanup (After Testing)
**Goal:** Remove legacy row-based code

**Tasks:**
1. Remove feature flag (if auto-layout is stable)
2. Delete old Timeline components:
   - `AddRowComponent.tsx`
   - `DraggableGroupRow.tsx` (row ordering)
   - Row management UI
3. Remove drag-and-drop code
4. Clean up unused row-related functions
5. Update documentation
6. Consider database cleanup:
   - Migration to remove `rows` table (optional, not urgent)
   - Migration to drop `rowId` column (optional, much later)

**Estimated Time:** 2-4 hours  
**Risk:** Low (cleanup only)

---

## Detailed Algorithm: Auto-Layout Service

### Input
```typescript
interface LayoutInput {
  projects: Project[];
  groupId: string;
  dateRange: { start: Date; end: Date };
  sortBy: 'startDate' | 'alphabetical';
  minGapDays: number; // Default: 2
}
```

### Algorithm Steps

1. **Filter Projects**
   - Only projects in groupId
   - Only projects with dates overlapping visible range
   - Sort by startDate or name

2. **Detect Overlaps** (with 2-day buffer)
   ```typescript
   function projectsOverlap(p1: Project, p2: Project, minGap: number): boolean {
     const gap = daysBetween(p1.endDate, p2.startDate);
     return gap < minGap; // True if too close
   }
   ```

3. **Assign to Visual Rows** (Greedy Algorithm)
   ```typescript
   const visualRows: VisualRow[] = [];
   
   for (const project of sortedProjects) {
     let placed = false;
     
     // Try to place in existing row
     for (const row of visualRows) {
       const lastProject = row.projects[row.projects.length - 1];
       if (!projectsOverlap(lastProject, project, minGapDays)) {
         row.projects.push(project);
         placed = true;
         break;
       }
     }
     
     // Create new row if needed
     if (!placed) {
       visualRows.push({
         rowNumber: visualRows.length,
         projects: [project],
         height: ROW_HEIGHT
       });
     }
   }
   ```

4. **Return Layout**
   ```typescript
   return {
     groupId,
     groupName,
     visualRows,
     totalHeight: visualRows.length * ROW_HEIGHT
   };
   ```

### Performance Considerations
- Memoize layout calculations by date range
- Recalculate only on scroll (debounced)
- Cache results per group
- Max ~100 projects per group for good performance

---

## Key Decisions

### 1. Projects No Longer Draggable ✅
**Rationale:**
- Auto-layout determines position
- Dragging would conflict with auto-arrangement
- Dates define position, not manual placement
- Reduces complexity significantly

**Alternative User Actions:**
- Edit project dates to move it
- Change group to move between groups

### 2. Minimum Gap: 2 Days
**Rationale:**
- Visual clarity
- Prevents projects from appearing to overlap
- Allows for timeline markers between projects

**Configurable:** Could be a setting later

### 3. Sort Order: Start Date (Primary)
**Rationale:**
- Most logical for timeline
- Users expect chronological order
- Alphabetical as secondary sort for same-date projects

### 4. Dynamic Row Calculation
**Trigger Recalculation On:**
- Timeline scroll (date range changes)
- Project CRUD operations
- Group changes
- Window resize (if affects visible dates)

**Optimization:**
- Debounce scroll events (100ms)
- Calculate only for visible date range
- Use virtual scrolling if needed

---

## Component Changes Map

### Core Timeline Components

#### `TimelineView.tsx` / `Timeline.tsx`
**Changes:**
- Add layout mode switcher (feature flag)
- Pass layout mode to child components
- Conditional rendering: old vs new timeline

#### `TimelineSidebar.tsx`
**Current:** Shows groups with expandable rows
**New:** Shows groups with dynamic height (no row names)

**Changes:**
```typescript
// Before
<Group>
  <Row name="Row 1" />
  <Row name="Row 2" />
</Group>

// After
<Group style={{ height: groupLayout.totalHeight }}>
  {/* Just group header, no sub-rows */}
</Group>
```

#### `DraggableRowComponent.tsx` → `AutoLayoutGroupRow.tsx`
**Changes:**
- Remove row filtering (`project.rowId === row.id`)
- Use visual rows from layout service
- Remove drag handlers
- Render projects from layout calculation

#### `AddProjectRow.tsx`
**Changes:**
- Remove hover-to-create functionality
- Keep "Add Project" button (opens modal)
- Remove all drag-zone logic

#### `ProjectTimeline.tsx` (Individual Project Bar)
**Changes:** Minimal
- Remove drag handlers
- Keep visual styling
- Position from layout service

---

### Components to Remove

#### 🗑️ `AddRowComponent.tsx`
- No longer needed (no manual rows)

#### 🗑️ Row ordering in `DraggableGroupRow.tsx`
- Keep group rendering
- Remove row reordering logic

#### 🗑️ `RowScrollIndicator.tsx`
- No rows to scroll through

---

## Testing Strategy

### Unit Tests
- [ ] Layout algorithm with various project combinations
- [ ] Overlap detection with 2-day gap
- [ ] Edge cases: continuous projects, same dates, empty groups
- [ ] Performance: 50+ projects in one group

### Integration Tests
- [ ] Timeline renders with new layout
- [ ] Scrolling recalculates layout correctly
- [ ] Project creation updates timeline
- [ ] Group changes trigger recalculation

### Manual Testing Scenarios
1. **Baseline:** 5 groups, 3-5 projects each, various dates
2. **Overlap:** Many projects in same timeframe
3. **Sparse:** Projects spread far apart
4. **Continuous:** Mix of regular and continuous projects
5. **Edge Cases:** Single project, empty group, future dates only
6. **Performance:** 100+ total projects
7. **Scrolling:** Fast scrolling left/right
8. **CRUD:** Add/edit/delete projects while timeline open

---

## Migration Strategy

### Phase 1: Parallel Deployment (Weeks 1-2)
- Deploy with feature flag OFF by default
- Internal testing with flag ON
- Collect feedback on auto-layout

### Phase 2: Beta Testing (Week 3)
- Enable for subset of users
- Monitor performance metrics
- Fix critical issues

### Phase 3: General Availability (Week 4)
- Enable for all users (flag still exists)
- Keep legacy mode as fallback

### Phase 4: Deprecation (Month 2+)
- Announce legacy mode deprecation
- Remove old timeline code
- Optional: Database cleanup (rows table)

---

## Rollback Plan

### If Auto-Layout Has Issues:
1. **Immediate:** Toggle feature flag OFF
2. **Users revert to legacy row-based timeline**
3. **No data loss** (rowId still in database)
4. **Fix issues in auto-layout**
5. **Re-deploy when stable**

### If Need to Abandon:
- All existing data intact
- rowId field remains functional
- Users continue with row-based system
- Document lessons learned

---

## Success Criteria

### Functional Requirements
- ✅ Timeline shows groups with dynamic rows
- ✅ Projects auto-arrange without overlaps
- ✅ 2-day minimum gap enforced
- ✅ Layout updates on scroll
- ✅ Projects sorted logically
- ✅ "Add Project" opens modal
- ✅ No manual project dragging

### Performance Requirements
- ✅ Layout calculation < 100ms for 50 projects
- ✅ Smooth scrolling (60 FPS)
- ✅ No visual jank during recalculation

### User Experience
- ✅ Intuitive without training
- ✅ Faster than manual row management
- ✅ No data loss or corruption
- ✅ Clear visual hierarchy

---

## Open Questions

1. **Should continuous projects float or anchor?**
   - Option A: Float at top of group
   - Option B: Arrange with regular projects
   - **Recommendation:** Arrange normally, they span many rows

2. **What if 10+ projects overlap?**
   - Option A: Create 10+ visual rows (could be tall)
   - Option B: Compress/stack visually with indicators
   - **Recommendation:** Create rows, let groups grow tall

3. **Sort order configurability?**
   - Option A: User setting (start date vs alphabetical)
   - Option B: Fixed start date sort
   - **Recommendation:** Start with fixed, add setting later

4. **Animation when layout changes?**
   - Option A: Smooth transitions when projects move
   - Option B: Instant update
   - **Recommendation:** Start instant, add animation later

---

## Resources Needed

### Development Time Estimate
- **Total:** 16-24 hours of focused development
- **Breakdown:**
  - Phase 1 (Foundation): 4-6 hours
  - Phase 2 (New UI): 6-8 hours
  - Phase 3 (Integration): 4-6 hours
  - Phase 4 (Cleanup): 2-4 hours

### Testing Time
- **Manual Testing:** 4-6 hours
- **User Acceptance:** 1-2 weeks

### Total Timeline
- **Development:** 1-2 weeks (part-time)
- **Testing & Deployment:** 2-3 weeks
- **Total:** 3-5 weeks to stable production

---

## Next Steps

### Immediate Actions
1. ✅ Review and approve this plan
2. ✅ Create feature flag in settings
3. ✅ Set up test environment
4. ✅ Begin Phase 1: Auto-layout service

### Decision Points
- [ ] Approve overall approach
- [ ] Confirm feature flag strategy
- [ ] Decide on sort order (date vs alphabetical)
- [ ] Timeline for beta testing
- [ ] Go/No-Go for Phase 2

---

## References

- Current Timeline: `src/components/timeline/`
- Project Types: `src/types/core.ts`
- Group Architecture: `docs/CLIENT_GROUP_LABEL_IMPLEMENTATION.md`
- Database Schema: `supabase/migrations/`

---

**Status:** Awaiting approval to proceed with Phase 1

**Last Updated:** October 28, 2025
