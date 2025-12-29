# PHASE TERMINOLOGY MIGRATION - STRICT INSTRUCTIONS

## PRIMARY OBJECTIVE
Replace ALL "milestone" terminology with "phase" terminology throughout the codebase while maintaining backward compatibility where required.

## CRITICAL RULES

### 1. NEVER revert to milestone terminology to "fix a bug"
- If a variable is undefined, trace it to its source and rename the SOURCE
- Do not rename uses back to match an outdated source
- Always migrate forward toward "phase", never backward toward "milestone"
- **Example of what NOT to do:**
  ```typescript
  // ❌ WRONG: Changing back to milestone because variable is undefined
  function calculate(milestone: PhaseDTO) {
    const endDate = phase.endDate; // Error: phase is not defined
    // WRONG FIX: Change parameter to milestone
  }
  
  // ✅ CORRECT: Fix by using the correct parameter name
  function calculate(phase: PhaseDTO) {
    const endDate = phase.endDate; // Now it works
  }
  ```

### 2. Parameter and Variable Naming Priority
- Function parameters: Use `phase` (not `milestone`)
- Local variables: Use `phase` (not `milestone`)
- Loop variables: Use `phase` (not `milestone`)
- Array map/filter: Use `phase` (not `milestone`, not `m`)
- Only use `milestone` in deprecated wrapper functions marked with `@deprecated`

### 3. Type Usage
- Primary type: `PhaseDTO` (for DTOs with optional startDate)
- Derived type: `Phase` (PhaseDTO & { startDate: Date })
- **Important:** `PhaseDTO` was created as the base DTO type, NOT to avoid conflicts
- Legacy type alias: `Phase = PhaseDTO` exists for backward compatibility

### 4. Backward Compatibility Strategy
- Export deprecated aliases: `export const oldName = newName;` with `@deprecated` tag
- Keep DB field names unchanged (they use 'phases' table already)
- Legacy API parameters stay as-is, but internal implementations use phase terminology
- Example:
  ```typescript
  // New primary function
  export function calculatePhaseDuration(phase: PhaseDTO): number {
    // implementation
  }
  
  // Deprecated wrapper for compatibility
  /** @deprecated Use calculatePhaseDuration */
  export const calculateMilestoneDuration = calculatePhaseDuration;
  ```

### 5. Comment Updates
- Replace "milestone" with "phase" in ALL comments
- Exception: When explaining legacy behavior, use "milestone (legacy term for phase)"
- Update function JSDoc `@param` from `milestone` to `phase`
- Update `@returns` descriptions to say "phase" not "milestone"
- Update inline comments to use "phase" terminology

### 6. Systematic Approach When Fixing Undefined Variables

**Step-by-Step Process:**
1. **Identify where the variable is defined** (function parameter, import, etc.)
2. **Rename the definition** from milestone → phase
3. **Update all references** to use the new name
4. **Never rename references back** to match an old definition

**Example Fix:**
```typescript
// Before (broken):
function processPhases(phases: PhaseDTO[]) {
  phases.forEach(milestone => {  // ← Definition
    const end = phase.endDate;   // ← Reference (undefined!)
  });
}

// ❌ WRONG FIX: Change reference to match definition
function processPhases(phases: PhaseDTO[]) {
  phases.forEach(milestone => {
    const end = milestone.endDate; // Changed back to milestone
  });
}

// ✅ CORRECT FIX: Change definition to match terminology
function processPhases(phases: PhaseDTO[]) {
  phases.forEach(phase => {      // ← Fixed definition
    const end = phase.endDate;   // ← Reference now works
  });
}
```

### 7. Testing After Changes
- Run tests after each logical group of changes
- Fix errors by continuing forward with phase terminology
- If imports fail, update the import source to export phase-named items
- **Never** fix by reverting to milestone terminology

### 8. Function Renaming Strategy
- Rename functions from `*Milestone*` to `*Phase*`
- Create deprecated wrapper with old name pointing to new function
- Update all call sites to use new function name
- Example:
  ```typescript
  // New function
  export function calculatePhaseDayEstimates(phase: PhaseDTO, ...): DayEstimate[] {
    // implementation
  }
  
  // Deprecated wrapper
  /** @deprecated Use calculatePhaseDayEstimates */
  export function calculateMilestoneDayEstimates(
    milestone: PhaseDTO, 
    ...
  ): DayEstimate[] {
    return calculatePhaseDayEstimates(milestone, ...);
  }
  ```

### 9. Files to Update (In Order)

#### ✅ Completed
- DragPositioning (added phaseId with milestone alias)
- DragCoordinator (routes via phaseId)
- TimelineView (uses phase handlers)
- DraggablePhaseMarkers (comment updates)
- usePhaseResize (sets phaseId in drag state)

#### ⏳ In Progress
- dayEstimateCalculations.ts
  - Function parameters renamed milestone → phase ✅
  - Need to rename function names
  - Need to update all comments
  - Need to scan for any remaining "milestone" strings

#### 📋 Pending
- PhaseRules.ts (needs comprehensive comment sweep)
- UnifiedPhaseService.ts (comment updates needed)
- usePhaseOperations.ts (needs more comment updates)
- ProjectModal.tsx (check for milestone references)
- calculationCache.ts (check for milestone in keys/comments)
- RelationshipRules.ts (check for milestone references)
- UnifiedProjectService.ts (has isMilestoneOverdue, calculateMilestoneDaysToComplete)

### 10. What NOT to Do

❌ **NEVER:**
- Change `phase` back to `milestone` in code you just renamed
- Leave `milestone` in comments when code uses `phase`
- Mix `milestone` and `phase` terminology in the same function
- Create new code using `milestone` terminology
- Fix undefined variable errors by reverting to `milestone`
- Rename uses to match an outdated definition name

✅ **ALWAYS:**
- Migrate forward toward `phase`
- Update definitions to use `phase`
- Keep terminology consistent within each function
- Add `@deprecated` tags when creating compatibility wrappers
- Update comments when updating code

### 11. Completion Criteria

The migration is complete when:

1. ✅ `grep -r "milestone" src/` returns only:
   - Deprecated wrapper functions with `@deprecated` tags
   - DB field names (if any remain)
   - Legacy compatibility aliases clearly marked
   - Migration documentation references

2. ✅ All tests pass with no errors

3. ✅ No undefined variable errors

4. ✅ All comments use "phase" terminology

5. ✅ All function names use `*Phase*` pattern (with deprecated `*Milestone*` wrappers where needed)

6. ✅ All parameters named `phase` (not `milestone`)

7. ✅ All local variables use `phase` terminology

## CURRENT STATUS (as of 2025-12-29)

### Recent Changes
- ✅ Function parameters in `dayEstimateCalculations.ts` renamed from `milestone` → `phase`
- ✅ Import added for `PhaseDTO` type
- ✅ Variable references updated to use `phase` parameter
- ✅ `isDeadlineOnly` created to replace `isMilestone` (with backward compat alias)

### Next Steps
1. Scan `dayEstimateCalculations.ts` for remaining "milestone" in:
   - Function names (rename to `*Phase*`)
   - Comments (update to use "phase")
   - Local variables (rename to `phase`)

2. Update `UnifiedProjectService.ts`:
   - Rename `isMilestoneOverdue` → `isPhaseOverdue`
   - Rename `calculateMilestoneDaysToComplete` → `calculatePhaseDaysToComplete`
   - Update all comments

3. Comprehensive comment sweep of remaining files listed in Pending section

## EMERGENCY STOP SCENARIOS

If you catch yourself:
- Changing a `phase` variable back to `milestone`
- About to "fix" an undefined variable by reverting terminology
- Mixing both terms in the same function

**STOP and:**
1. Identify the root definition causing the issue
2. Rename the definition forward to `phase`
3. Continue migration in the forward direction only
