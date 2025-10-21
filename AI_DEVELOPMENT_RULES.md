# 🚨 AI Development Guide

## INSTRUCTION FOR AI COPILOT
This guide must be followed for ALL code changes in this project.

> **🤖 AI REMINDER**: For complex features involving multiple service layers, workflows, or architectural decisions, ALSO read `Architecture Guide.md` to understand the complete services architecture, service layer responsibilities, and development workflow patterns.

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
✅ Dates from `dateCalculations.ts`  
✅ **Find existing unified services** - look for `Unified*Service` pattern  
✅ Delegation pattern in unified services  

## WHERE CODE GOES (Updated October 2025)

| Code Type | Location | Pattern | Example |
|-----------|----------|---------|---------|
| UI | `/components` | Call orchestrators or unified services | `<div>{UnifiedXService.getData()}</div>` |
| Complex Workflows | `/services/orchestrators/*Orchestrator` | CREATE/UPDATE/DELETE with validation | `ProjectOrchestrator.executeProjectCreationWorkflow()` |
| Calculations | `/services/unified/Unified*Service` | READ/TRANSFORM operations | `UnifiedProjectService.calculateDuration()` |
| Business Rules | `/domain/rules/*Rules` | Single source of truth | `ProjectRules.validateProjectDates()` |
| Date/Time Math | `/services/calculations/general/dateCalculations` | Pure calculations | `calculateDurationHours()` |
| **Validation** | **Inline in orchestrators** | **Call domain rules directly** | `ProjectRules.validate()` (NO validator layer) |
| **Data Access** | **Inline in orchestrators OR hooks** | **Direct Supabase calls** | `supabase.from('projects').insert()` (NO repository layer) |
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
import { calculateDurationHours, normalizeToMidnight } from '@/services';

// ❌ WRONG  
date.setHours(0, 0, 0, 0); // NEVER manual date ops
```

## CHECKLIST (Updated October 2025)
- [ ] Did I check if this exists? (`grep -r`)
- [ ] Am I importing from `@/services`?
- [ ] Am I using core.ts types?
- [ ] Am I using dateCalculations for dates?
- [ ] Are unified services delegating to domain layers?
- [ ] Is business logic in services, not components?
- [ ] Am I calling domain rules directly (not creating validator wrappers)?
- [ ] Am I calling Supabase directly (not creating repository wrappers)?
- [ ] Are orchestrators handling workflows with inline validation?
- [ ] Are transformation helpers inline in orchestrators (private methods)?

## 🎯 DEVELOPMENT PHILOSOPHY
**"Find existing, extend existing, create new only when necessary"**
- Look for similar services first
- Use existing patterns and naming
- Maintain architectural principles over exact naming conventions
