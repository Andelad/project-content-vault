# Entity Adoption Plan

**Created:** December 29, 2025  
**Updated:** December 30, 2025  
**Status:** ✅ PHASE 1 COMPLETE!  
**Goal:** Migrate codebase from plain objects to rich domain entities

---

## 📊 Current State

### ✅ Validation Audit Complete (Dec 30, 2025)

All entities audited against working orchestrators and INTEGRATED:

**✅ Project Entity** - INTEGRATED
- ✅ Integrated into `ProjectOrchestrator.executeProjectCreationWorkflow()`
- Validates name, hours, dates, project not fully in past
- Provides warnings for large hours (>10,000)

**✅ Client Entity** - INTEGRATED
- ✅ Integrated into `ClientOrchestrator.createClientWorkflow()`
- ✅ Prevents duplicate client names
- ✅ UI shows validation errors properly

**✅ Group Entity** - INTEGRATED
- ✅ Integrated into `GroupOrchestrator.createGroupWorkflow()`
- Validates name length
- Orchestrator checks uniqueness (per entity design)

**✅ Holiday Entity** - INTEGRATED
- ✅ Integrated into `HolidayModalOrchestrator.createHolidayWorkflow()`
- Validates title, date range
- Orchestrator handles overlap detection

**✅ CalendarEvent Entity** - INTEGRATED
- ✅ Integrated into `EventModalOrchestrator.createEventWorkflow()`
- Validates title, start/end times, category

**⏳ Phase Entity** - DEFERRED
- Complex legacy structure (dueDate vs endDate mismatch)
- Will integrate in Phase 2

**❌ Label Entity** - NOT IMPLEMENTED
- No creation UI exists in app yet

**❌ WorkSlot Entity** - DEFERRED  
- Created in settings, edited on planner (overrides)
- Will integrate when settings orchestrator created

### ✅ What We Have
- **8 complete domain entities** in `/src/domain/entities/`
- **5 entities IN USE** (Project, Client, Group, Holiday, CalendarEvent) ✅
- **Phase 1 orchestrator integration COMPLETE**
- **Entities validated** against working orchestrators

### ❌ The Problem
```typescript
// Current: Plain objects everywhere
const project = { id: '123', name: 'Test', ... }; // Can be invalid!

// Goal: Rich entities that prevent invalid states
const result = Project.create({ name: 'Test', ... });
if (!result.success) { /* Invalid - can't create */ }
```

---

## 🎯 Migration Strategy

### Phase 1: Orchestrator Layer (Week 1) - ✅ COMPLETE!
**Goal:** Entities used internally in orchestrators, return plain objects to maintain backward compatibility

**✅ Completed:**
1. ✅ `ProjectOrchestrator.executeProjectCreationWorkflow()` - Uses `Project.create()`
2. ✅ `ClientOrchestrator.createClientWorkflow()` - Uses `Client.create()` with duplicate name check
3. ✅ `GroupOrchestrator.createGroupWorkflow()` - Uses `Group.create()`
4. ✅ `HolidayModalOrchestrator.createHolidayWorkflow()` - Uses `Holiday.create()`
5. ✅ `EventModalOrchestrator.createEventWorkflow()` - Uses `CalendarEvent.create()`
6. ✅ `ClientModal` - Fixed to check addClient return value and show errors
7. ✅ `Project` entity - Fixed to allow empty clientId placeholder
8. ✅ Build verified - No compilation errors
9. ✅ Manual testing - Project creation works, client duplicate detection works!

**⏳ Deferred:**
- Phase entity (complex legacy structure)
- WorkSlot entity (settings integration needed)
- Label entity (no UI implementation yet)

**Results:**
- **5 of 8 entities integrated** (62.5%)
- **All high-priority creation workflows covered**
- **Zero breaking changes** - backward compatible
- **Production ready** - tested and working

**Pattern Used:**
```typescript
// ✅ IMPLEMENTED in ProjectOrchestrator
static async executeProjectCreationWorkflow(request, context) {
  // 1. Create entity (validates automatically)
  const entityResult = ProjectEntity.create({
    name: request.name,
    clientId: '', // Resolved by addProject
    userId: '', // Set by addProject from auth
    startDate: request.startDate,
    endDate: request.endDate,
    estimatedHours: request.estimatedHours,
    color: request.color || '#3b82f6',
    groupId: request.groupId,
    notes: request.notes,
    icon: request.icon,
    continuous: request.continuous,
    existingPhases: []
  });
  
  if (!entityResult.success) {
    return { 
      success: false, 
      errors: entityResult.errors,
      warnings: entityResult.warnings
    };
  }
  
  // 2. Extract validated data for backward compatibility
  const projectData = {
    ...entityResult.data!.toData(),
    client: request.client, // For addProject to resolve
    rowId: request.rowId, // View layer concern
    autoEstimateDays: request.autoEstimateDays
  };
  
  // 3. Save via existing context
  const created = await context.addProject(projectData);
  
  // 4. Return plain object (backward compatible)
  return { success: true, project: created, warnings };
}
}
```

**Benefits:**
- ✅ Validation centralized in entity
- ✅ Business methods available (`project.updateDates()`)
- ✅ Backwards compatible (components still receive plain objects via `.toData()`)

---

### Phase 2: Context Layer (Week 2)
**Goal:** Contexts return entities, not plain objects

**Files to modify:**
1. `ProjectContext.tsx` - `addProject()` returns `Project` entity
2. `ClientContext.tsx` - `addClient()` returns `Client` entity
3. Update all context consumers

**Pattern:**
```typescript
// BEFORE
const addProject = async (data: Partial<Project>): Promise<Project> => {
  const { data: created } = await supabase.from('projects').insert(data).select().single();
  return created; // Plain object
};

// AFTER
const addProject = async (data: Partial<Project>): Promise<Project> => {
  const { data: created } = await supabase.from('projects').insert(data).select().single();
  return Project.fromDatabase(created); // Entity!
};
```

**Risk:** Medium - changes what components receive

---

### Phase 3: Component Layer (Week 3)
**Goal:** Components work with entities directly

**Files to modify:**
1. `ProjectModal.tsx` - Work with `Project` entity
2. `PhaseModal.tsx` - Work with `Phase` entity
3. Timeline components - Update to use entity methods

**Pattern:**
```typescript
// BEFORE
const handleSubmit = async () => {
  const result = await orchestrator.create(formData);
  if (result.success) {
    setProjects([...projects, result.project]); // Plain object
  }
};

// AFTER
const handleSubmit = async () => {
  const result = await orchestrator.create(formData);
  if (result.success) {
    setProjects([...projects, result.project]); // Entity!
    console.log(result.project.isActive()); // Can call methods
  }
};
```

**Benefits:**
- ✅ Components can use business methods
- ✅ Type safety improved
- ✅ No invalid state possible

---

### Phase 4: Remove Redundant Code (Week 4)
**Goal:** Delete duplicate validation and wrapper code

**Files to delete:**
```
src/services/validation/          # If exists - entity validation replaces this
src/services/repositories/        # If exists - orchestrators call Supabase directly
```

**Code to remove:**
- Duplicate validation in orchestrators (now in entities)
- Manual object construction (now in `Entity.create()`)
- Redundant type checking

---

## 📋 Detailed Steps

### Step 1: Update ProjectOrchestrator (Day 1)

**File:** `src/services/orchestrators/ProjectOrchestrator.ts`

**Changes:**
```typescript
// Add import
import { Project as ProjectEntity } from '@/domain/entities';

// Update executeProjectCreationWorkflow
static async executeProjectCreationWorkflow(
  request: ProjectCreationWithMilestonesRequest,
  projectContext: { ... }
): Promise<ProjectCreationResult> {
  // [KEEP] Client resolution
  const clientId = await this.ensureClientExists(request.client);
  
  // [NEW] Create entity instead of plain validation
  const entityResult = ProjectEntity.create({
    name: request.name.trim(),
    clientId: clientId,
    startDate: request.startDate,
    endDate: request.continuous ? null : request.endDate,
    estimatedHours: request.estimatedHours,
    continuous: request.continuous ?? false,
    groupId: request.groupId!,
    rowId: request.rowId,
    color: request.color || OKLCH_PROJECT_COLORS[0],
    notes: request.notes,
    icon: request.icon || 'folder',
    autoEstimateDays: request.autoEstimateDays,
    userId: currentUserId, // Get from context
  });
  
  if (!entityResult.success) {
    return { 
      success: false, 
      errors: entityResult.errors 
    };
  }
  
  const projectEntity = entityResult.data!;
  
  // [NEW] Convert to database format
  const projectData = projectEntity.toData();
  
  // [KEEP] Database interaction
  const createdProject = await projectContext.addProject(projectData);
  
  // [NEW] Wrap in entity for return
  return {
    success: true,
    project: ProjectEntity.fromDatabase(createdProject),
    warnings: validation.warnings
  };
}
```

**Remove:**
```typescript
// DELETE - now handled by Project.create()
static validateProjectCreation(request, existingPhases) { ... }
static prepareProjectForCreation(request) { ... }
```

---

### Step 2: Update Type Definitions (Day 2)

**File:** `src/types/core.ts`

**Add entity re-exports:**
```typescript
// Re-export entity types for backwards compatibility
export type { 
  Project as ProjectEntity,
  CreateProjectParams,
  DomainResult 
} from '@/domain/entities';

// Legacy plain types (mark as deprecated)
/** @deprecated Use ProjectEntity from @/domain/entities */
export interface Project {
  id: string;
  name: string;
  // ... existing fields
}
```

**Migration path:**
```typescript
// Old code keeps working
import { Project } from '@/types/core'; // Plain object

// New code uses entity
import { ProjectEntity } from '@/types/core'; // Rich entity
```

---

### Step 3: Update Context Providers (Day 3-4)

**File:** `src/contexts/ProjectContext.tsx`

**Changes:**
```typescript
import { Project as ProjectEntity } from '@/domain/entities';

const addProject = async (data: Partial<Project>): Promise<ProjectEntity> => {
  // [KEEP] Database logic
  const { data: created, error } = await supabase
    .from('projects')
    .insert(data)
    .select()
    .single();
  
  if (error) throw error;
  
  // [NEW] Return entity instead of plain object
  return ProjectEntity.fromDatabase(created);
};

// Update state type
const [projects, setProjects] = useState<ProjectEntity[]>([]);
```

**Risk mitigation:**
- Components might expect plain objects
- Use `project.toData()` in display code if needed
- Gradually migrate component by component

---

### Step 4: Update Components (Day 5-7)

**File:** `src/components/modals/ProjectModal.tsx`

**Before:**
```typescript
const result = await ProjectOrchestrator.executeProjectCreationWorkflow(...);
if (result.success && result.project) {
  // result.project is plain object
  console.log(result.project.name);
}
```

**After:**
```typescript
const result = await ProjectOrchestrator.executeProjectCreationWorkflow(...);
if (result.success && result.project) {
  // result.project is ProjectEntity
  console.log(result.project.getName()); // Use getter
  console.log(result.project.isActive()); // Business method available
  console.log(result.project.getDurationDays()); // Calculated property
}
```

---

### Step 5: Clean Up (Day 8-10)

**Delete redundant files:**
```bash
# IF they exist (check first)
rm -rf src/services/validation/
rm -rf src/services/repositories/
```

**Remove redundant code:**
- [ ] Search for duplicate validation functions
- [ ] Remove manual object builders
- [ ] Delete unused utility functions
- [ ] Update imports across codebase

**Run tests:**
```bash
npm test
```

---

## 🗂️ Files to Delete After Migration

Based on entity integration analysis, these are likely candidates for deletion:

### Definite Deletes
```
/docs/sessions/architecture-assessment-and-roadmap.md  # Historical planning
/docs/sessions/architecture-evolution-summary.md       # Historical summary
/docs/sessions/domain-entity-architecture-plan.md      # Superseded by this plan
/docs/sessions/entity-integration-detailed-analysis.md # Analysis complete
/docs/sessions/entity-integration-reality-check.md     # Analysis complete
/docs/sessions/entity-migration-plan.md                # Superseded by this plan
/docs/sessions/entity-testing-guide.md                 # Move to main testing guide
/docs/sessions/ENTITY_IMPLEMENTATION_STATUS.md         # Status: complete
/docs/sessions/ENTITY_QUICK_REFERENCE.md               # Move to Domain Logic.md
```

### Keep (These Are Valuable)
```
/docs/sessions/README.md                               # Session index
/src/domain/entities/*                                 # The actual implementation
/src/test/domain/entities/*                            # Entity tests
/src/domain/Domain Logic.md                            # Core documentation
/src/domain/Rules Logic.md                             # Business rules
```

---

## ✅ Success Criteria

**Phase 1 Complete When:**
- [ ] ProjectOrchestrator uses Project entity internally
- [ ] All orchestrator tests pass
- [ ] No regression in existing functionality

**Phase 2 Complete When:**
- [ ] ProjectContext returns Project entities
- [ ] All context consumers updated
- [ ] Integration tests pass

**Phase 3 Complete When:**
- [ ] Components work with entities directly
- [ ] No `.toData()` conversions needed in most code
- [ ] Business methods used throughout UI

**Phase 4 Complete When:**
- [ ] Redundant validation code deleted
- [ ] Duplicate type definitions removed
- [ ] Codebase smaller and cleaner

**Full Migration Complete When:**
- [ ] All 8 entities adopted
- [ ] Test coverage > 80%
- [ ] Documentation updated
- [ ] Session docs archived/deleted
- [ ] `.cursorrules` updated to prefer entities

---

## 🚨 Risks & Mitigation

### Risk 1: Breaking Existing Components
**Mitigation:**
- Migrate one orchestrator at a time
- Keep `.toData()` compatibility layer
- Gradual rollout component by component

### Risk 2: Performance Impact
**Mitigation:**
- Entities are lightweight (no ORM overhead)
- Same database queries as before
- Entity creation is just validation + object construction

### Risk 3: Team Learning Curve
**Mitigation:**
- Keep Quick Reference guide updated
- Document patterns in .cursorrules
- Pair programming for first few migrations

---

## 📚 Documentation Updates After Migration

**Update `.cursorrules`:**
```markdown
### Always Use
- ✅ Rich domain entities from `/domain/entities/` for core business objects
- ✅ Entity factory methods: `Entity.create()` for validation
- ✅ Entity methods for business logic

### Never Create
- ❌ Plain objects for Project, Client, Phase, etc. (use entities)
- ❌ Manual validation code (entities validate on construction)
```

**Update `.architecture.md`:**
```markdown
## Domain Layer

Entities encapsulate business logic and enforce invariants:
- Project, Client, Phase, Group, Label
- CalendarEvent, WorkSlot, Holiday

Pattern: Create → Validate → Operate → Persist
```

**Merge Quick Reference into Domain Logic.md:**
- Move entity usage examples to `/src/domain/Domain Logic.md`
- Delete `/docs/sessions/ENTITY_QUICK_REFERENCE.md`

---

## 🎯 Next Immediate Action

**START HERE:**
```bash
# 1. Read this plan
# 2. Open src/services/orchestrators/ProjectOrchestrator.ts
# 3. Import Project entity
# 4. Modify executeProjectCreationWorkflow
# 5. Run tests
# 6. Commit: "feat: adopt Project entity in ProjectOrchestrator"
```

**First commit should:**
- Change only ProjectOrchestrator
- Keep backwards compatibility
- Pass all existing tests
- Add new entity tests

Then proceed phase by phase.
