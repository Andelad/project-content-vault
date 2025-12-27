# My Build Guide - Fixing & Improving the Codebase

**Purpose:** Quick reference for cleaning up legacy code, fixing errors, and aligning implementation with business logic.

---

## 🎯 When You Encounter an Error or Legacy Code

### Example: "Recurring estimates error" or "Milestones still referenced"

**Follow this sequence:**

1. **Understand the Problem** (5 min)
   - What's the error message?
   - What old concept is being used? (e.g., "milestones", "recurring estimates")
   - What's the new concept? (e.g., "phases", "phase allocations")

2. **Check App Logic First** (10 min)
   - Open `docs/core/App Logic.md`
   - Search for old term (e.g., "milestone")
   - Search for new term (e.g., "phase")
   - **Question:** Is App Logic clear and correct?
   - **If NO:** Fix App Logic first, then continue
   - **If YES:** Note the correct business rules

3. **Check Business Logic** (5 min)
   - Open `docs/core/Business Logic.md`
   - Search for old term
   - **Question:** Does it match App Logic?
   - **If NO:** Fix Business Logic to match App Logic
   - **If YES:** Note the detailed specs

4. **Find All Code References** (5 min)
   ```bash
   # Search for old term in codebase
   grep -r "milestone" src/ --include="*.ts" --include="*.tsx"
   
   # Count occurrences
   grep -r "milestone" src/ --include="*.ts" --include="*.tsx" | wc -l
   
   # Find in specific layers
   grep -r "milestone" src/domain/
   grep -r "milestone" src/services/
   grep -r "milestone" src/components/
   ```

5. **Create Fix Plan** (10 min)
   - List all files that need updating
   - Identify which layer each file is in (domain, services, components)
   - **Priority order:**
     1. Domain rules (`src/domain/rules/`)
     2. Orchestrators (`src/services/orchestrators/`)
     3. Unified services (`src/services/unified/`)
     4. Hooks (`src/hooks/`)
     5. Components (`src/components/`)

6. **Instruct AI Layer by Layer** (variable time)
   - Start with domain rules
   - Work outward to UI
   - **One layer at a time!**

---

## 📋 AI Instruction Template

When you've identified what needs fixing, use this template:

```markdown
**Context:**
- Old concept: [e.g., "milestones"]
- New concept: [e.g., "phases"]
- What changed: [e.g., "Milestones renamed to phases, time allocation moved to phase level"]

**Business Rules (from App Logic.md):**
[Copy relevant section or summarize]

**Files to Update:**
1. src/domain/rules/[OldRules.ts] → [NewRules.ts]
2. src/services/orchestrators/[OldOrchestrator.ts]
3. [list all files]

**Instructions:**
1. Update domain rules first: [specific changes]
2. Update Business Logic.md to match new domain rules
3. Update orchestrators to use new domain rules
4. Update unified services [specific changes]
5. Update components [specific changes]
6. Search for any remaining references to old term and update

**Verification:**
- [ ] Grep shows zero results for old term
- [ ] App Logic.md is accurate
- [ ] Business Logic.md matches App Logic.md
- [ ] Domain rules have @see references to App Logic.md
- [ ] No errors in terminal
```

---

## 🔄 The Fix Workflow (Step by Step)

### Phase 1: Clarity (Documentation First)

1. **Fix App Logic**
   - Open `docs/core/App Logic.md`
   - Find the section about the concept
   - Ask yourself: "Is this clear and correct?"
   - Fix any [CLARIFY] items or unclear rules
   - Document edge cases

2. **Fix Business Logic**
   - Open `docs/core/Business Logic.md`
   - Update to match App Logic
   - Add detailed specs, method signatures
   - Add validation rules

3. **Commit Documentation**
   ```bash
   git add docs/core/App Logic.md docs/core/Business Logic.md
   git commit -m "logic: clarify [concept] - resolved [issue]"
   ```

### Phase 2: Implementation (Code Second)

4. **Fix Domain Rules**
   - Update or create `src/domain/rules/[Concept]Rules.ts`
   - Add `@see` references to App Logic
   - Follow exact Business Logic specs
   
   **Instruct AI:**
   ```
   Update src/domain/rules/PhaseRules.ts to implement the phase 
   validation rules from Business Logic.md Rule X. Add @see 
   reference to App Logic.md Part Y, Rule Z.
   ```

5. **Fix Orchestrators**
   - Update `src/services/orchestrators/[Concept]Orchestrator.ts`
   - Call new domain rules
   - Remove calls to old domain rules
   
   **Instruct AI:**
   ```
   Update ProjectOrchestrator to use PhaseRules instead of 
   MilestoneRules. Search for all milestone references and 
   replace with phase logic.
   ```

6. **Fix Unified Services**
   - Update calculations to use new domain rules
   - Ensure delegation pattern (services should NOT implement logic)
   
   **Instruct AI:**
   ```
   Update UnifiedProjectService.calculateTimeline() to call 
   PhaseRules instead of implementing phase logic directly.
   ```

7. **Fix Hooks & Components**
   - Update last (UI layer depends on services)
   
   **Instruct AI:**
   ```
   Search all components for "milestone" and update to "phase".
   Update prop names, state variables, and display text.
   ```

### Phase 3: Cleanup

8. **Search & Verify**
   ```bash
   grep -r "old_term" src/              # Find stragglers
   find src/ -name "*OldConcept*"       # Find old files
   npm run build                         # Test
   ```

9. **Commit**
   ```bash
   git commit -m "refactor: replace [old] with [new]"
   ```

---

## 🎯 Common Scenarios (Quick Fixes)

| Problem | Solution |
|---------|----------|
| Old term still referenced | `grep -r "old_term" src/ > refs.txt` → Instruct AI to update layer by layer |
| Logic unclear/contradictory | Fix App Logic.md first → Update Business Logic.md → Then code |
| Calculation in component | "Move calculation from Component to UnifiedXService per .cursorrules" |
| Database has old columns | Create `INSTRUCTIONS_FOR_LOVABLE_*.md` → Push → Update types |

---

## ✅ Before You're Done Checklist

After any significant change:

- [ ] App Logic.md is accurate and clear
- [ ] Business Logic.md matches App Logic.md
- [ ] Domain rules have `@see` references
- [ ] Grep for old terms returns zero or acceptable results
- [ ] `npm run build` succeeds with no errors
- [ ] No console errors in browser
- [ ] Commit messages follow format (`logic:`, `refactor:`, etc.)

---

## 🚨 Golden Rules

1. **Specify the layer** - "Update domain rules", not "update the code"
2. **Reference docs** - "Per App Logic.md Rule 5..."
3. **One layer at a time** - Domain → Services → Components
4. **Name files** - Actual file names, not vague concepts
5. **Documentation first** - Always fix docs before code

---

## 📚 Quick Reference

| To find... | Look in... |
|------------|------------|
| What app should do | `docs/core/App Logic.md` |
| Detailed specs | `docs/core/Business Logic.md` |
| Code organization | `docs/core/Architecture Guide.md` |
| Where code goes | `.cursorrules` section 2 |
| Business rules | `src/domain/rules/` |
| Workflows (CRUD) | `src/services/orchestrators/` |
| Calculations | `src/services/unified/` |

---

**Remember:** Fix docs first. Follow the layers. Search constantly. Small commits.
