# 🚨 AI Development Guide

## INSTRUCTION FOR AI COPILOT
This guide must be followed for ALL code changes in this project.

> **🤖 AI REMINDER**: For complex features involving multiple service layers, workflows, or architectural decisions, ALSO read `docs/architecture/Architecture Guide.md` to understand the complete services architecture, service layer responsibilities, and development workflow patterns.

---

## BEFORE WRITING ANY CODE
```bash
# Check if similar functionality exists
grep -r "functionName" src/services/
# Look for existing unified services
ls src/services/unified/ | grep -i "relevant-domain"
```

## NEVER CREATE
❌ `/helpers/` directories (ambiguous - use proper service layers instead)  
❌ Business logic in `/utils/` (calculations, validations, domain logic)  
❌ Calculations in components  
❌ Duplicate types (use `/types/core.ts`)  
❌ Manual date math  

## ALWAYS USE
✅ Import from `@/services` only  
✅ Types from `/types/core.ts`  
✅ Dates from `dateCalculations.ts` (normalizeToMidnight, addDaysToDate, etc.)  
✅ **ErrorHandlingService for all errors** - structured logging with context  
✅ **Find existing unified services** - look for `Unified*Service` pattern  
✅ Delegation pattern in unified services  

## WHERE CODE GOES (Updated November 2025)

| Code Type | Location | Pattern | Example |
|-----------|----------|---------|---------|
| UI | `/components` | Call orchestrators or unified services | `<div>{UnifiedXService.getData()}</div>` |
| Complex Workflows | `/services/orchestrators/*Orchestrator` | CREATE/UPDATE/DELETE with validation | `ProjectOrchestrator.executeProjectCreationWorkflow()` |
| Calculations | `/services/unified/Unified*Service` | READ/TRANSFORM operations | `UnifiedProjectService.calculateDuration()` |
| Business Rules | `/domain/rules/*Rules` | Single source of truth | `ProjectRules.validateProjectDates()` |
| Date/Time Math | `/services/calculations/general/dateCalculations` | Pure calculations | `calculateDurationHours()`, `normalizeToMidnight()` |
| **Error Handling** | **`ErrorHandlingService`** | **Structured logging + toast** | `ErrorHandlingService.handle(error, context, { showToast: true })` |
| **Validation** | **Inline in orchestrators** | **Call domain rules directly** | `ProjectRules.validate()` (NO validator layer) |
| **Data Access** | **Inline in orchestrators OR hooks** | **Direct Supabase calls** | `supabase.from('projects').insert()` (NO repository layer) |
| **React Coordination** | **`/hooks/use*.ts`** | **State + service calls** | `useProjectDrag()` (manages state, calls services) |
| Generic Utils | `/utils` or `/lib` | Framework helpers | `cn()`, `formatCurrency()`, `debounce()` |

**Key Changes:**
- ❌ NO `/validators` folder - call domain rules directly
- ❌ NO `/repositories` folder - call Supabase directly (except timeTrackingRepository)
- ✅ Orchestrators handle validation + data access inline

## CRITICAL PATTERNS (Updated October 2025)

### 🔍 Find Existing Services First
```bash
# Before creating ProjectService, check:
ls src/services/unified/ | grep -i project
ls src/services/orchestrators/ | grep -i project
# Use whatever exists: UnifiedProjectService, ProjectOrchestrator, etc.
```

### Components → Orchestrators (for workflows)
```typescript
// ✅ RIGHT - Use orchestrator for CREATE/UPDATE/DELETE
import { ProjectOrchestrator } from '@/services';
const result = await ProjectOrchestrator.executeProjectCreationWorkflow(data, context);

// ❌ WRONG - Component calling database directly
const { data } = await supabase.from('projects').insert(projectData);
```

### Components → Unified Services (for calculations)
```typescript
// ✅ RIGHT - Use unified service for calculations
import { UnifiedProjectService } from '@/services';
const duration = UnifiedProjectService.calculateDuration(project);

// ❌ WRONG - Manual calculations in components  
const duration = (end - start) / (1000 * 60 * 60);
```

### Orchestrators Call Domain Rules Directly (NO validator layer)
```typescript
// ✅ RIGHT - Orchestrator calls domain rules directly
export class ProjectOrchestrator {
  static async executeProjectCreationWorkflow(request, context) {
    // Call domain rules directly
    const validation = ProjectRules.validateProjectDates(request.startDate, request.endDate);
    if (!validation.isValid) return { success: false, errors: validation.errors };
    
    // Call Supabase directly (no repository)
    const { data, error } = await supabase.from('projects').insert(prepared);
  }
}

// ❌ WRONG - Creating validator wrapper
export class ProjectValidator {
  static validate(project) {
    return ProjectRules.validate(project); // Unnecessary wrapper!
  }
}
```

### Orchestrators Call Supabase Directly (NO repository layer)
```typescript
// ✅ RIGHT - Orchestrator calls Supabase directly
export class ProjectOrchestrator {
  static async executeProjectCreationWorkflow(request, context) {
    const prepared = this.transformToDatabase(request);
    const { data, error } = await supabase.from('projects').insert(prepared).select().single();
    return this.transformFromDatabase(data);
  }
  
  // Transformation helpers inline as private methods
  private static transformToDatabase(request) { /* ... */ }
  private static transformFromDatabase(data) { /* ... */ }
}

// ❌ WRONG - Creating repository wrapper
export class ProjectRepository {
  async create(project) {
    return supabase.from('projects').insert(project); // Unnecessary wrapper!
  }
}
```

### Unified Services MUST Delegate
```typescript
// ✅ RIGHT - Unified service delegates to domain layer
export class UnifiedProjectService {
  static calculateDuration(project: Project): number {
    return DateCalculations.calculateProjectDuration(project); // DELEGATE!
  }
}

// ❌ WRONG - Unified service implementing logic
export class UnifiedProjectService {
  static calculateDuration(project: Project): number {
    return (project.end - project.start) / (1000 * 60 * 60); // NO!
  }
}
```

### Types - ONLY extend core.ts
```typescript
// ✅ RIGHT
import { Project } from '@/types/core';
interface LocalProject extends Project { temp?: boolean; }

// ❌ WRONG
interface Project { id: string; } // NEVER redefine!
```

### Dates - ONLY use dateCalculations
```typescript
// ✅ RIGHT
import { calculateDurationHours, normalizeToMidnight, addDaysToDate } from '@/services';
const midnight = normalizeToMidnight(new Date());
const future = addDaysToDate(today, 7);

// ❌ WRONG  
date.setHours(0, 0, 0, 0); // NEVER manual date ops
const future = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000); // NEVER manual arithmetic
```

### Error Handling - ALWAYS use ErrorHandlingService
```typescript
// ✅ RIGHT - Structured error handling
import { ErrorHandlingService, ErrorSeverity } from '@/services';

try {
  await saveProject(project);
} catch (error) {
  ErrorHandlingService.handle(error, {
    source: 'ProjectModal',
    action: 'saveProject',
    metadata: { projectId: project.id }
  }, {
    showToast: true,
    severity: ErrorSeverity.ERROR,
    userMessage: 'Failed to save project. Please try again.'
  });
}

// ❌ WRONG - Inconsistent error handling
try {
  await saveProject(project);
} catch (error) {
  console.error('Error:', error); // NO!
  toast({ title: 'Error', description: 'Something went wrong' }); // NO!
}
```

## CHECKLIST (Updated November 2025)
- [ ] Did I check if this exists? (`grep -r`)
- [ ] Am I importing from `@/services`?
- [ ] Am I using core.ts types?
- [ ] Am I using dateCalculations for dates (NO manual .setHours or arithmetic)?
- [ ] Am I using ErrorHandlingService for all errors?
- [ ] Are unified services delegating to domain layers?
- [ ] Is business logic in services, not components?
- [ ] Am I calling domain rules directly (not creating validator wrappers)?
- [ ] Am I calling Supabase directly (not creating repository wrappers)?
- [ ] Are orchestrators handling workflows with inline validation?
- [ ] Are transformation helpers inline in orchestrators (private methods)?
- [ ] If creating a hook, does it only coordinate services (no business logic)?
- [ ] Are calculations in services, not hooks or components?

## 🎯 DEVELOPMENT PHILOSOPHY
**"Find existing, extend existing, create new only when necessary"**
- Look for similar services first
- Use existing patterns and naming
- Maintain architectural principles over exact naming conventions

---

## 🎣 CUSTOM HOOKS - React Coordination Layer

### ✅ When to Create Custom Hooks
Create a custom hook when you need to:
- **Manage React state** with service coordination (useState, useReducer)
- **Handle complex DOM events** (drag handlers, scroll listeners, resize observers)
- **Coordinate multiple services** with React lifecycle (useEffect, useCallback)
- **Reuse React patterns** across multiple components
- **Clean up side effects** (event listeners, subscriptions, timers)

### ❌ Never Put in Hooks
- ❌ Business logic (belongs in `domain/rules`)
- ❌ Calculations (belongs in `services/calculations` or `services/unified`)
- ❌ Workflows (belongs in `services/orchestrators`)
- ❌ Database operations (belongs in orchestrators or data-fetching hooks)
- ❌ Pure functions (belongs in services)

### ✅ Correct Hook Pattern
```typescript
// ✅ GOOD: Hook coordinates services + manages React state
export function useProjectDrag(config: ProjectDragConfig) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  
  const handleMouseDown = useCallback((e: React.MouseEvent, projectId: string, action: string) => {
    // Initialize using service
    const initialState = initializeDragState(project, action, e.clientX, e.clientY);
    setIsDragging(true);
    setDragState(initialState);
    
    const handleMouseMove = (e: MouseEvent) => {
      // Call service for calculations
      const result = TimelineDragCoordinatorService.coordinateDragOperation(
        dragState, e, timelineContext
      );
      // Update React state
      setDragState(result.newDragState);
    };
    
    // Setup DOM listeners
    document.addEventListener('mousemove', handleMouseMove);
    // ... cleanup
  }, [config]);
  
  return { isDragging, dragState, handleMouseDown };
}

// Component uses the hook
function TimelineView() {
  const { isDragging, dragState, handleMouseDown } = useProjectDrag({
    projects, updateProject, viewportStart, dates
  });
  // ... render
}
```

### ❌ Wrong Hook Pattern
```typescript
// ❌ BAD: Hook implements business logic
export function useProjectDrag(config) {
  const handleMouseDown = useCallback((e, projectId) => {
    // ❌ WRONG: Calculating in hook instead of using service
    const deltaX = e.clientX - startX;
    const daysDelta = Math.round(deltaX / 50);
    const newDate = new Date(startDate);
    newDate.setDate(startDate.getDate() + daysDelta);
    
    // ❌ WRONG: Business validation in hook
    if (newDate < minDate || newDate > maxDate) {
      return;
    }
    
    // ❌ WRONG: Database call in hook
    await supabase.from('projects').update({ startDate: newDate });
  }, []);
}
```

### 📋 Hook Decision Tree
```
Do I need React state management?
  YES → Do I need to coordinate services?
    YES → Create custom hook ✅
    NO → Keep state in component ✅
  NO → Do I need calculations?
    YES → Use existing service ✅
    NO → Is this a workflow?
      YES → Use orchestrator ✅
      NO → Create utility function ✅
```

### 🔄 Hook Examples
```typescript
// ✅ Data fetching hook (thin Supabase wrapper)
function useProjects() {
  const [projects, setProjects] = useState([]);
  useEffect(() => {
    supabase.from('projects').select('*').then(setProjects);
  }, []);
  return projects;
}

// ✅ React coordination hook (manages state + calls services)
function useTimelineNavigation(config) {
  const [isAnimating, setIsAnimating] = useState(false);
  
  const handleNavigate = useCallback((direction) => {
    const target = TimelineViewportService.calculateNavigationTarget(config, direction);
    createSmoothDragAnimation(config, target, () => setIsAnimating(false));
  }, [config]);
  
  return { isAnimating, handleNavigate };
}

// ✅ DOM event coordination hook
function useTimelineAutoScroll(viewport) {
  const [autoScrollState, setAutoScrollState] = useState(null);
  
  const checkAutoScroll = useCallback((mouseX) => {
    const config = TimelineViewportService.calculateAutoScrollTrigger(mouseX);
    if (config.shouldScroll) {
      setAutoScrollState(config);
    }
  }, [viewport]);
  
  return { autoScrollState, checkAutoScroll };
}
```

### 🎯 Hook Naming Convention
- ✅ `useProjectDrag` - Manages project drag state + coordinates DragCoordinator service
- ✅ `useHolidayDrag` - Manages holiday drag state + coordinates DragCoordinator service
- ✅ `useTimelineNavigation` - Manages navigation state + coordinates ViewportService
- ✅ `useTimelineAutoScroll` - Manages auto-scroll state + coordinates ViewportService
- ✅ `useProjects` - Fetches project data (thin Supabase wrapper)

### 🚨 Services Don't Change
**Important**: Creating hooks does NOT require changing existing services!
- Services remain pure and stateless
- Services continue to do calculations and coordination
- Hooks just wrap React-specific concerns (state, lifecycle, DOM events)
- Same service functions are called, just from hooks instead of components
