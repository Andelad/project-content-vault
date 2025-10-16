# 📁 Folder Architecture - Quick Reference

## Three-Folder Separation (No Overlap)

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR CODEBASE STRUCTURE                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📁 /lib                                                     │
│  ├─ Purpose: Framework utilities (NO domain knowledge)      │
│  ├─ Example: cn() for className merging                     │
│  └─ Rule: Third-party patterns, generic algorithms          │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📁 /utils                                                   │
│  ├─ Purpose: Date/time DISPLAY formatting ONLY             │
│  ├─ Example: formatDate(), formatMonthYear()               │
│  └─ Rule: Simple wrappers around .toLocaleDateString()     │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📁 /services                                                │
│  ├─ Purpose: ALL business logic & calculations              │
│  ├─ Example: formatDuration(), calculateProjectDuration()  │
│  └─ Rule: Everything with domain knowledge                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Decision Tree

```
New utility function?
│
├─ Has domain knowledge? ──────────► /services
│  (projects, milestones, work hours)
│
├─ Is it a date/time display? ─────► /utils
│  (wraps .toLocaleDateString())
│
└─ Is it framework/generic? ───────► /lib
   (no app-specific knowledge)
```

## Examples

### ✅ /lib Examples
```typescript
cn(...classes)              // Framework utility
debounce(fn, delay)        // Generic algorithm
isValidEmail(email)        // Generic validation
```

### ✅ /utils Examples
```typescript
formatDate(date)           // Date display
formatDateShort(date)      // Date display
formatMonthYear(date)      // Date display
```

### ✅ /services Examples
```typescript
formatDuration(hours)              // Time calculation
calculateProjectDuration(project)  // Business logic
validateMilestone(milestone)       // Domain validation
UnifiedProjectService.create()     // Workflow
```

## Import Patterns

```typescript
// Framework utilities
import { cn } from '@/lib/utils';

// Date display
import { formatDate } from '@/utils/dateFormatUtils';

// Business logic (via barrel)
import { formatDuration, UnifiedProjectService } from '@/services';
```

## Key Principle

**"Domain knowledge = services, framework = lib, display = utils"**
