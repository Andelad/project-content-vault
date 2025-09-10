# 🚨 AI RULES - STOP AND READ

## INSTRUCTION FOR AI COPILOT
Create a file called `AI_DEVELOPMENT_RULES.md` in the project root directory with this exact content. This guide must be followed for ALL code changes.

---

## BEFORE WRITING ANY CODE
```bash
grep -r "functionName" src/services/  # Check if it exists
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
✅ Delegation pattern in unified services  

## WHERE CODE GOES

| Code Type | Location | Example |
|-----------|----------|---------|
| UI | `/components` | `<div>{UnifiedService.getData()}</div>` |
| Business Logic | `/services/unified/Unified*Service` | **MUST delegate to domain layers** |
| Date/Time | `/services/calculations/dateCalculations` | `calculateDurationHours()` |
| Workflows | `/services/orchestrators` | Multi-step processes |
| Validation | `/services/validators` | Business rules |
| Generic Utils | `/utils` or `/lib` | `cn()`, `formatCurrency()`, `debounce()` |

## CRITICAL PATTERNS

### Components → Services
```typescript
// ✅ RIGHT
import { UnifiedProjectService } from '@/services';
const duration = UnifiedProjectService.calculateDuration(project);

// ❌ WRONG
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
