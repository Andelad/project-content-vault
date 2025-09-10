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

## WHERE CODE GOES

| Code Type | Location | Pattern | Example |
|-----------|----------|---------|---------|
| UI | `/components` | Call unified services | `<div>{UnifiedXService.getData()}</div>` |
| Business Logic | `/services/unified/Unified*Service` | **MUST delegate to domain layers** | Any `Unified*Service` |
| Date/Time | `/services/calculations/dateCalculations` | Pure calculations | `calculateDurationHours()` |
| Workflows | `/services/orchestrators` | Multi-step processes | `*Orchestrator` |
| Validation | `/services/validators` | Business rules | `*Validator` |
| Generic Utils | `/utils` or `/lib` | Framework helpers | `cn()`, `formatCurrency()`, `debounce()` |

## CRITICAL PATTERNS

### 🔍 Find Existing Services First
```bash
# Before creating ProjectService, check:
ls src/services/unified/ | grep -i project
# Use whatever exists: UnifiedProjectService, UnifiedProjectManager, etc.
```

### Components → Services
```typescript
// ✅ RIGHT - Use whatever unified service exists
import { UnifiedProjectService } from '@/services'; // or UnifiedTimeTrackerService, etc.
const duration = UnifiedProjectService.calculateDuration(project);

// ❌ WRONG - Manual calculations in components  
const duration = (end - start) / (1000 * 60 * 60);
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

## CHECKLIST
- [ ] Did I check if this exists? (`grep -r`)
- [ ] Am I importing from `@/services`?
- [ ] Am I using core.ts types?
- [ ] Am I using dateCalculations for dates?
- [ ] Are unified services delegating to domain layers?
- [ ] Is business logic in services, not components?

## 🎯 DEVELOPMENT PHILOSOPHY
**"Find existing, extend existing, create new only when necessary"**
- Look for similar services first
- Use existing patterns and naming
- Maintain architectural principles over exact naming conventions
