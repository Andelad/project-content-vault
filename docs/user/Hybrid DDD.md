# Architecture Philosophy: Hybrid DDD

**Last Updated:** December 29, 2025  
**Current Approach:** Hybrid Domain-Driven Design (DDD)  
**Future Migration:** Strict DDD (if needed)

---

## Our Current Philosophy: Hybrid DDD

### What We Do

**Pure Documentation, Pragmatic Code**

We maintain **strict separation in documentation** while allowing **pragmatic mixing in code**:

```
📚 Documentation (Co-located with Code):
├── /.architecture.md           → Overall architecture philosophy
├── /src/domain/
│   ├── Domain Logic.md         → Domain concepts (100% UI-agnostic)
│   ├── Rules Logic.md          → Domain rules & calculations (UI-agnostic)
│   └── Display Logic.md        → Display-specific business rules
└── /src/components/
    └── README.md               → Component organization

💻 Code (Pragmatically Mixed):
├── domain/rules/       → Pure domain logic ✅
├── domain/entities/    → Rich domain models ✅
├── services/orchestrators/ → MIXED: App logic + UI prep + DB access
├── services/unified/   → Business calculations ✅
└── components/         → UI display ✅
```

**Key Principle:** Documentation lives near the code it describes.
- All domain documentation together in `/src/domain/`
- Component organization in `/src/components/`
- Architecture at project root (alongside `.cursorrules`)

### Where We Stay Pure

**Domain Rules** (`domain/rules/`) - Never compromise:
- ❌ NO UI references ("timeline", "calendar", "view")
- ❌ NO presentation logic (styling, display decisions)
- ✅ ONLY universal business rules

**Domain Entities** (`domain/entities/`) - Rich models:
- ✅ Encapsulate business logic
- ✅ Validate on construction
- ❌ NO UI concerns

### Where We Mix (Intentionally)

**Orchestrators** (`services/orchestrators/`) - Pragmatic glue layer:
- ✅ Application workflows (CREATE/UPDATE/DELETE)
- ✅ Call domain validation (ProjectRules.validate())
- ✅ Direct database access (supabase.from()... - NO repository layer)
- ✅ Transform for database (mapping concerns)
- ✅ Enrich for UI display (presentation prep)
- ✅ Coordinate side effects (notifications, updates)

**Example:**
```typescript
async createProject(data: CreateProjectInput) {
  // ✅ Call domain validation
  const validation = ProjectRules.validateCreate(data);
  
  // ✅ Transform for DB (presentation - allowed)
  const dbData = this.transformForDatabase(data);
  
  // ✅ Direct DB access (no repository layer)
  const project = await supabase.from('projects').insert(dbData);
  
  // ✅ Enrich for UI (presentation - allowed)
  return this.enrichForDisplay(project);
}
```

### Why Hybrid?

**Velocity vs Purity Trade-off:**

| Aspect | Strict DDD | Hybrid DDD (Our Choice) |
|--------|-----------|-------------------------|
| **Layer Separation** | 100% code separation | Pure domain, mixed orchestrators |
| **Repository Layer** | Required abstraction | Direct Supabase calls |
| **Entity Usage** | Everywhere | Domain layer only |
| **Development Speed** | Slower (more abstraction) | Faster (pragmatic) |
| **Maintenance Clarity** | Code self-documents | Documentation self-documents |
| **Migration Effort** | 8-12 weeks | Already done ✅ |

**Our Bet:** Clear documentation provides architectural clarity faster than full code separation.

---

## Key Architectural Decisions

### 1. Three-Layer Documentation Model

**Domain Logic** (`/src/domain/Domain Logic.md`) defines WHAT exists (domain truth):
- "Projects have three time types: auto-estimated, planned, completed"
- "All time types coexist in the domain simultaneously"

**Rules Logic** (`/src/domain/Rules Logic.md`) defines HOW calculations work (domain rules):
- "Auto-estimate = (Remaining Hours) ÷ (Days without events)"
- "Events exclude days from auto-estimate distribution"

**Display Logic** (`/src/domain/Display Logic.md`) defines WHERE display constraints apply:
- "Timeline View shows only ONE time type per day (mutual exclusivity)"
- "Calendar View can show multiple time types (no overlap constraint)"

### 2. Domain Truth vs UI Constraints

**Example: Rule 9 (Daily Time Allocation)**

**Domain Truth** (Rules Logic):
- Auto-estimated, planned, and completed time all exist
- Calculations run regardless of display
- All time types are always available

**Display Constraint** (Display Logic):
- Timeline bars can't overlap visually
- Display only ONE type per day in Timeline View
- Same data shown differently in Calendar View

### 3. No Repository Layer

**Why:** Supabase already provides:
- Type-safe queries
- Row-level security
- Real-time subscriptions
- Query builder

Adding repositories would create:
- Wrapper methods that just delegate
- Extra abstraction with no value
- Development slowdown

**Pattern:**
```typescript
// ✅ Direct Supabase (our approach)
const { data } = await supabase.from('projects').select('*');

// ❌ Repository wrapper (unnecessary)
const data = await projectRepository.findAll();
```

---

## Migration Path: Moving to Strict DDD

**When to Consider:**
- Team grows beyond 5-7 developers
- Domain logic leaking into orchestrators becomes painful
- Multiple clients need same backend (API reuse)
- Testing becomes difficult due to mixed concerns

### Phase 1 (Current) → Phase 2 (Strict DDD)

**What Changes:**

### 1. Add Repository Layer (3-4 weeks)

**Current:**
```typescript
// Orchestrators call Supabase directly
await supabase.from('projects').insert(data);
```

**Strict DDD:**
```typescript
// Orchestrators call repositories
await projectRepository.create(data);

// repositories/ProjectRepository.ts
class ProjectRepository {
  async create(data: Project): Promise<Project> {
    return await supabase.from('projects').insert(data);
  }
}
```

**Effort:** 
- Create repository for each entity (9 files)
- Update all orchestrator calls
- Add repository tests

### 2. Extract Presentation Logic (2-3 weeks)

**Current:**
```typescript
// Orchestrators mix app + presentation
class ProjectOrchestrator {
  async createProject(data) {
    const dbData = this.transformForDatabase(data); // Presentation
    const project = await supabase.insert(dbData);
    return this.enrichForDisplay(project); // Presentation
  }
}
```

**Strict DDD:**
```typescript
// Application Services (pure app logic)
class ProjectApplicationService {
  async createProject(data: CreateProjectInput) {
    const validation = ProjectRules.validate(data);
    const project = await projectRepository.create(data);
    return project; // Pure entity
  }
}

// Presentation Adapters (UI prep)
class ProjectPresentationAdapter {
  static enrichForDisplay(project: Project) {
    return { ...project, displayColor: ... };
  }
}
```

**Effort:**
- Create application services layer (9 files)
- Create presentation adapters layer (new folder)
- Migrate all orchestrator logic
- Update component imports

### 3. Enforce Entity Usage (1-2 weeks)

**Current:**
```typescript
// Orchestrators work with plain data
const project = { id: '123', name: 'Test' };
```

**Strict DDD:**
```typescript
// Everything uses entity instances
const project = Project.create({ name: 'Test' });
if (!project.success) return project.errors;

const entity = project.data; // Always a Project instance
entity.isActiveOnDate(today); // Use entity methods
```

**Effort:**
- Update all orchestrators to use entities
- Update all unified services to accept entities
- Ensure entities used in components

### 4. Update Documentation (1 week)

**Effort:**
- Update `.architecture.md` with new layers
- Document repository patterns
- Update AI decision matrix
- Add migration notes

---

## Total Migration Estimate

**Time:** 8-12 weeks (depending on team size)

**Breakdown:**
- Week 1-4: Repository layer + tests
- Week 5-7: Extract presentation logic
- Week 8-9: Enforce entity usage everywhere
- Week 10-11: Update documentation
- Week 12: Buffer for issues

**Risk:** Medium (no breaking changes, gradual migration possible)

**Benefit:** Full code-level layer separation, easier testing, API reuse

---

## Decision: Stay Hybrid for Now

**Reasons:**
1. **Documentation clarity achieved** - Architecture is well-documented
2. **Velocity priority** - Hybrid approach ships features faster
3. **Small team** - Current team size doesn't justify strict separation
4. **No pain points yet** - Mixing isn't causing maintenance issues
5. **Easy migration path** - Can move to strict DDD when needed

**Review Triggers:**
- Team grows beyond 7 developers
- Domain logic appearing in orchestrators (violation of current rules)
- Testing becomes difficult
- Need to build separate API/mobile client

---

## Quick Reference

**Current Architecture (Hybrid DDD):**
```
Components → Orchestrators (workflows) → Domain Rules + Supabase
          → Unified Services (calcs) → calculations/ + Domain Rules
```

**Future Architecture (Strict DDD):**
```
Components → Presentation Adapters → Application Services → Repositories → Supabase
                                   ↓
                            Domain Entities (everywhere)
                                   ↓
                              Domain Rules
```

**Documentation (Never Changes):**
```
App Logic → Business Logic → View Specifications
(Pure domain truth, regardless of code approach)
```

---

**Bottom Line:** We chose clarity through documentation over purity through code. Migration to Strict DDD is straightforward when needed.
