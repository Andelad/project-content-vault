# Logic Consolidation Process Guide
## A Systematic Approach to Understanding and Refining Your Business Logic

**Document Version**: 1.0.0  
**Last Updated**: October 27, 2025  
**Purpose**: Help you methodically think through and consolidate domain rules, calculations, and business logic

---

## Overview

You've identified that your codebase has:
- ✅ Good domain rules structure
- ✅ Comprehensive calculations
- ⚠️ Some duplication and scattered logic
- ❓ Areas needing your thinking to clarify

This guide provides a **step-by-step process** to help you get your head around it all and make informed decisions about consolidation.

---

## The Problem

### What Makes This Hard

You're dealing with:
1. **Multiple representations** of similar concepts (working days calculated 3+ ways)
2. **Domain rules vs calculations** - where does each belong?
3. **Historical decisions** - why did we do it this way?
4. **Implicit knowledge** - rules that exist in your head but aren't documented
5. **Interconnected logic** - changing one thing affects many others

### Your Goal

Create a **single source of truth** where:
- Every concept has ONE clear definition
- Every calculation has ONE implementation (or clearly documented variants)
- Business rules are separated from implementation details
- You can confidently answer: "How does X work?"

---

## The Process

### Phase 1: Map the Current State (1-2 hours)

**Goal**: Understand what you have without changing anything yet.

#### Step 1.1: Create an Entity Map

Create a simple diagram or document:

```
Entity: Project
  Properties I care about:
    - estimatedHours (budget)
    - startDate, endDate
    - autoEstimateDays (which days count)
    
  Questions I need to answer:
    - What's the difference between "calendar days" and "working days"?
    - Does continuous vs time-limited affect calculations?
    - Can a project have zero milestones? (Yes, it can)
    
  Calculations that use this:
    - calculateProjectDuration()
    - calculateAutoEstimateWorkingDays()
    - calculateProjectDayEstimates()
```

**Do this for**: Projects, Milestones, Calendar Events, Work Hours, Day Estimates

**Tool**: Use a note-taking app, whiteboard, or even pen and paper

---

#### Step 1.2: Map Calculation Flows

Pick 3-5 key user scenarios and trace the calculation flow:

**Example Scenario: "Show day estimates for a project"**

```
User wants: Timeline showing how many hours needed each day

Flow:
1. START: User has project with milestones
2. System needs: Which days to show estimates
   → Calls: isWorkingDayForEstimates()
   → Uses: project.autoEstimateDays + holidays
   → Returns: boolean per day

3. System needs: Hours per day
   → Calls: calculateMilestoneDayEstimates()
   → Uses: milestone.timeAllocationHours / working days
   → Returns: DayEstimate[] array

4. System needs: Filter out days with events
   → Rule: Events block estimates
   → Implementation: Check if events exist for (project, date)
   
5. Display: Show estimate circles on timeline

Questions this raises:
- Why do we have autoEstimateDays on project AND weeklyWorkHours in settings?
- What if they conflict?
- Should we validate they're consistent?
```

**Do this for**:
- Showing day estimates
- Creating a milestone
- Calculating if project is over budget
- Determining if a day is overbooked
- Calculating project duration

**Output**: Flow diagrams or written descriptions

---

#### Step 1.3: Identify Decision Points

As you map, note every place where you're unsure:

```
DECISION POINT #1: Working Days Definition

Current state:
- project.autoEstimateDays says "Mon-Fri" for THIS project
- settings.weeklyWorkHours says "Mon-Thu, Sat" for MY schedule

Question: Which one wins for day estimates?

Current implementation: 
- Day estimate calculation uses autoEstimateDays if present
- Falls back to weeklyWorkHours if not

Is this right? 
- [ ] Yes, keep it
- [ ] No, should always use one or the other
- [ ] Maybe, needs user input to decide

My thinking needed:
- What's the use case for different days per project?
- Example: Client A only on Mon/Wed/Fri, Client B any weekday
- Conclusion: _______________
```

**Template**:
```
DECISION POINT #X: [Name]

Current state: [What code does now]
Question: [What you're unsure about]
Current implementation: [Where/how it's done]
Is this right? [Options]
My thinking needed: [What you need to figure out]
Conclusion: [Leave blank for now]
```

**Create one for each**: Uncertainty you encounter while mapping

---

### Phase 2: Think Through the Hard Parts (2-4 hours, spread across multiple sessions)

**Goal**: Make decisions on the unclear areas

This is where YOUR domain knowledge is critical. The code can't tell you what the business requirements should be.

#### Step 2.1: Prioritize Your Decision Points

Not all decisions are equal. Rank them:

**Priority 1 - CRITICAL**: Affects core user experience or data integrity
- Example: "How do milestones drive day estimates?"
- Example: "Can milestone budget exceed project budget?"

**Priority 2 - IMPORTANT**: Affects calculation accuracy or consistency
- Example: "Which working day definition should we use?"
- Example: "How do recurring milestones count toward budget?"

**Priority 3 - NICE TO HAVE**: Improves clarity but doesn't break anything
- Example: "Should we rename confusing function names?"
- Example: "Should we consolidate duplicate implementations?"

**Work through Priority 1 first.**

---

#### Step 2.2: Use the "5 Whys" Technique

For each Priority 1 decision, ask "Why?" five times:

**Example: "Why do we have both autoEstimateDays and weeklyWorkHours?"**

```
1. Why do we have both?
   → Because autoEstimateDays is per-project, weeklyWorkHours is global

2. Why do we need per-project working days?
   → Because different projects might have different schedules

3. Why would projects have different schedules?
   → Example: Client A only meets Mon/Wed, Client B any weekday

4. Why does that matter for day estimates?
   → Day estimates should only show on days I'll work on that project

5. Why not just use my global schedule for all projects?
   → Because then estimates would show on days I don't plan to work that project

Conclusion: autoEstimateDays is project-specific forecast
            weeklyWorkHours is my actual availability
            Both are needed, different purposes
            
Action: Document this distinction clearly in definitions
```

---

#### Step 2.3: Create "What If" Scenarios

Test your understanding with edge cases:

**Format**:
```
SCENARIO: [Unusual but possible situation]

Given:
- Project with 120 hours budget
- 3 milestones: 40h, 50h, 30h (exactly 120h total)
- User tries to add 4th milestone: 10h

What should happen?
Option A: Reject - would exceed budget
Option B: Allow - warn user they're over budget
Option C: Allow - auto-increase project budget

Current behavior: [Check the code]

My decision: Option ___ because _______________

Rationale: [Your thinking]
```

**Create scenarios for**:
- Over-budget situations
- Continuous projects (no end date)
- Zero-milestone projects
- Multi-day events
- Overlapping work hours
- Recurring milestones with short project durations

---

#### Step 2.4: Document Your Decisions

As you make decisions, write them down:

```
DECISION LOG

Date: 2025-10-27
Decision: Working days definition
Status: DECIDED

Context:
Two ways to define working days existed:
1. project.autoEstimateDays - which days to show estimates
2. settings.weeklyWorkHours - my availability

Problem:
Confusing which to use, seemed duplicative

Analysis:
- Different purposes (see 5 Whys above)
- autoEstimateDays = project-specific forecast schedule
- weeklyWorkHours = my capacity schedule

Decision:
KEEP BOTH - they serve different purposes

Implementation:
- Day estimates: Use autoEstimateDays (with fallback to weeklyWorkHours)
- Capacity checks: Use weeklyWorkHours
- Document the distinction in DOMAIN_DEFINITIONS.md

Affected areas:
- Day estimate calculations
- Working day helpers
- Project creation UI (should prompt for autoEstimateDays)

Next steps:
- [ ] Update domain definitions
- [ ] Add validation: warn if autoEstimateDays enables days with no weeklyWorkHours
- [ ] Add UI hint explaining the distinction
```

**Keep this log** - it's your record of WHY you made each choice

---

### Phase 3: Create Your Ideal Design (1-2 hours)

**Goal**: Design how it SHOULD work (ignoring current implementation)

#### Step 3.1: Write the Ideal Flow

For each key scenario, write how it should work in plain English:

**Example: "Creating a milestone"**

```
IDEAL FLOW: Create Milestone

1. User inputs:
   - Name
   - Deadline (endDate)
   - Time allocation (hours)
   - Optional: Start date, recurring pattern

2. System validates:
   CHECK: Deadline within project dates
   → CALL: ProjectRules.isDateWithinProject(deadline, project)
   → IF invalid: Error "Milestone deadline must be within project timeline"
   
   CHECK: Time allocation is positive
   → CALL: MilestoneRules.validateTimeAllocation(hours)
   → IF invalid: Error "Time allocation must be greater than zero"
   
   CHECK: Won't exceed project budget
   → CALL: ProjectRules.canAccommodateAdditionalHours(project, milestones, hours)
   → IF invalid: Error "Adding this milestone would exceed project budget"
   
   CHECK: If recurring, pattern is valid
   → CALL: MilestoneRules.validateRecurringPattern(config)
   → IF invalid: Error with specific pattern issue

3. System saves:
   - Create milestone record
   - Trigger day estimate recalculation (background)
   - Update project budget utilization display

4. System confirms:
   - "Milestone created"
   - Show updated budget utilization: "90 of 120 hours allocated (75%)"
```

**Key insight**: This documents the RULE (what should happen) separate from the IMPLEMENTATION (how code does it)

---

#### Step 3.2: Define the Single Source of Truth for Each Concept

Create a table:

| Concept | Definition | Single Source | Calculation | Used By |
|---------|-----------|---------------|-------------|---------|
| **Project Duration** | Calendar days from start to end | `ProjectRules.calculateProjectDuration()` | `(endDate - startDate) / day` | Timeline display, progress calculation |
| **Working Day (Estimates)** | Day where estimates should show | `isWorkingDayForEstimates()` | Uses `autoEstimateDays` + holidays | Day estimate calculations |
| **Working Day (Capacity)** | Day where I can work | `isWorkingDay()` | Uses `weeklyWorkHours` + holidays | Capacity checks, availability |
| **Budget Utilization** | % of project budget allocated | `MilestoneRules.calculateBudgetUtilization()` | `(SUM(milestones) / projectBudget) * 100` | Budget warnings, project cards |
| **Day Estimate** | Hours needed on a day | `calculateMilestoneDayEstimates()` | `milestone hours / working days` | Timeline display |

**Fill this out for**: Every major concept in your system

---

### Phase 4: Compare Ideal vs Current (1 hour)

**Goal**: Identify gaps and unnecessary complexity

#### Step 4.1: Gap Analysis

For each ideal flow, compare to current:

```
COMPARISON: Milestone Creation

Ideal:
1. Validate deadline within project dates
2. Validate positive time allocation
3. Check budget constraint
4. Validate recurring pattern (if applicable)
5. Save and recalculate

Current:
1. ✅ Validate deadline - EXISTS in MilestoneRules
2. ✅ Validate positive hours - EXISTS in MilestoneRules
3. ⚠️  Check budget - PARTIAL (different implementations)
4. ✅ Validate recurring - EXISTS in MilestoneRules
5. ❌ Recalculation - MISSING (done on page reload only)

Gaps:
- Budget check is duplicated across MilestoneRules and milestoneCalculations
- Background recalculation doesn't exist
- No transaction rollback if validation fails late

Actions needed:
1. Consolidate budget check to single implementation
2. Add optimistic recalculation hook
3. Add error boundaries for late validation
```

---

#### Step 4.2: Duplication Inventory

Using the audit from CALCULATION_REFERENCE.md, categorize duplicates:

**Category 1: Harmful Duplication** (different results, confusing)
- Example: `getWorkingDaysBetween()` in two places with different logic
- Action: **MUST FIX** - Pick one, deprecate other

**Category 2: Intentional Duplication** (domain rules + calculations)
- Example: `calculateTotalAllocation()` in MilestoneRules and milestoneCalculations
- Action: **REFACTOR** - Calculations should call rules

**Category 3: Benign Duplication** (same name, clearly different purpose)
- Example: `calculateDuration()` in different contexts
- Action: **DOCUMENT or RENAME** - Make distinction clear

---

### Phase 5: Create an Action Plan (30 minutes)

**Goal**: Turn analysis into concrete tasks

#### Step 5.1: Prioritized Task List

```
CONSOLIDATION ROADMAP

=== PHASE 1: Critical Fixes (Do First) ===

[ ] Fix harmful duplication: getWorkingDaysBetween()
    - Choose dayEstimateCalculations version as canonical
    - Rename projectCalculations version to getWorkingDaysByWorkHours()
    - Update all call sites
    - Add deprecation notice
    Estimated: 1 hour

[ ] Consolidate budget checks
    - Make milestoneCalculations call MilestoneRules
    - Remove duplicate logic
    - Add tests for edge cases
    Estimated: 2 hours

[ ] Document working day distinction
    - Update DOMAIN_DEFINITIONS.md
    - Add inline comments to functions
    - Create migration guide for developers
    Estimated: 1 hour

=== PHASE 2: Important Improvements (Do Second) ===

[ ] Add missing validations
    - Pre-save validation in milestone form
    - Budget check before allowing add
    - Recurring pattern validation UI
    Estimated: 3 hours

[ ] Optimize calculation calls
    - Cache day estimate results
    - Batch recalculations
    - Add performance monitoring
    Estimated: 4 hours

=== PHASE 3: Nice to Have (Do Later) ===

[ ] Rename confusing functions
[ ] Add comprehensive tests
[ ] Create developer guides
```

---

#### Step 5.2: Validation Checkpoints

After each phase, verify:

```
CHECKPOINT QUESTIONS

After Phase 1:
- [ ] Can I explain working days to someone in 2 minutes?
- [ ] Do all budget checks give the same result?
- [ ] Are duplications clearly documented?

After Phase 2:
- [ ] Do validations catch problems before save?
- [ ] Are performance issues addressed?
- [ ] Is the code easier to understand?

After Phase 3:
- [ ] Would a new developer find this intuitive?
- [ ] Are all concepts documented?
- [ ] Do tests cover edge cases?
```

---

## Thinking Tools

### Tool 1: The "Explain to a Stranger" Test

For each concept, try explaining it to someone who doesn't know your app:

```
"A milestone is... [your explanation]"

If you struggle or it takes > 2 minutes: The concept needs clarification
If you need caveats ("except when..."): Document those edge cases
If you use jargon: Define it in DOMAIN_DEFINITIONS.md
```

---

### Tool 2: The "What Could Go Wrong?" Checklist

For each calculation:

```
Calculation: calculateDayEstimate()

What could go wrong?
- [ ] What if project has no milestones? → Use auto-estimate
- [ ] What if milestone spans 0 working days? → Return empty array
- [ ] What if holiday list is empty? → Works fine (optional param)
- [ ] What if dates are in the past? → Should still calculate (for history)
- [ ] What if hours are negative? → Validation should prevent (add test)
```

---

### Tool 3: The "Delete Test"

For duplicated code:

```
Duplication: calculateProjectWorkingDays() exists in 2 places

The Delete Test:
1. Comment out implementation #1
2. Run the app
3. What breaks?
   → Milestone segment calculations fail
   
4. Comment out implementation #2 instead
5. Run the app  
6. What breaks?
   → Capacity planning calculations fail

Conclusion: Both are used, but maybe they don't need to be different?
Action: Investigate if they can share implementation
```

---

## Anti-Patterns to Avoid

### ❌ Analysis Paralysis

**Symptom**: You've been documenting for 3 days and haven't made a decision

**Fix**: Set a timer. Give yourself 30 minutes per decision point, then DECIDE. You can always revise.

---

### ❌ Premature Optimization

**Symptom**: "Should we use a cache here? Should this be async?"

**Fix**: First make it CORRECT and CLEAR. Then optimize if needed.

---

### ❌ Perfectionism

**Symptom**: "This isn't perfect, so I won't commit it"

**Fix**: Done is better than perfect. Ship the 80% solution, iterate.

---

### ❌ Scope Creep

**Symptom**: "While I'm here, I should also refactor X, Y, and Z..."

**Fix**: Stick to your action plan. Note other improvements for later.

---

## Workshop Template

Use this when you sit down to think:

```
CONSOLIDATION SESSION

Date: _______________
Time Budget: _______ hours
Focus: _______________

=== BEFORE ===
Current confusion:
[What you don't understand]

Questions I need to answer:
1. 
2.
3.

=== DURING ===
[Take notes as you work through the process]

Decisions made:
- 

Aha moments:
- 

New questions raised:
- 

=== AFTER ===
What I learned:
[Summary]

What I decided:
[Key decisions]

Next session should focus on:
[What to tackle next]

Time spent: _______ hours
Energy level: _______ /10
Confidence in decisions: _______ /10
```

---

## Recommended Session Structure

### Session 1: Initial Mapping (2 hours)
- Read through DOMAIN_DEFINITIONS.md
- Read through CALCULATION_REFERENCE.md
- Create entity map (Step 1.1)
- Map 2-3 calculation flows (Step 1.2)
- List decision points (Step 1.3)

**Output**: List of questions you need to answer

---

### Session 2: Core Decisions (2 hours)
- Pick top 3 Priority 1 decision points
- Use 5 Whys technique
- Create what-if scenarios
- Make decisions and document

**Output**: Decision log with 3 decisions

---

### Session 3: Ideal Design (1.5 hours)
- Write ideal flows for 3 key scenarios
- Create single source of truth table
- Don't worry about current code yet

**Output**: How it SHOULD work

---

### Session 4: Gap Analysis (1.5 hours)
- Compare ideal vs current
- Categorize duplications
- Identify critical vs nice-to-have gaps

**Output**: Gap list

---

### Session 5: Action Plan (1 hour)
- Create prioritized task list
- Break tasks into 1-4 hour chunks
- Set checkpoints
- Schedule follow-up sessions

**Output**: Concrete action plan

---

## Success Metrics

You'll know you're done when:

- ✅ You can explain any concept in < 2 minutes
- ✅ You know exactly where to find any calculation
- ✅ You have a clear decision on each uncertainty
- ✅ New developers can understand the system from docs
- ✅ Duplications are either removed or clearly justified
- ✅ You feel confident making changes

---

## Resources Created for You

You now have:

1. **DOMAIN_DEFINITIONS.md** - Plain-English explanations of what things are
2. **CALCULATION_REFERENCE.md** - Complete list of all calculations with formulas
3. **BUSINESS_LOGIC_REFERENCE.md** - All business rules and constraints (already existed)
4. **This guide** - Process to think through consolidation

---

## Next Steps

1. **Schedule your sessions** - Block time on your calendar
2. **Start with Session 1** - Initial mapping (don't skip this!)
3. **Take breaks** - This is mentally intensive work
4. **Document as you go** - Future you will thank you
5. **Commit decisions** - Don't leave them in limbo

---

## Getting Unstuck

If you get stuck on a decision:

### Strategy 1: Phone a Friend
Explain the problem to someone else (rubber duck debugging)

### Strategy 2: Sleep On It
Step away, let your subconscious work on it

### Strategy 3: Make a Reversible Choice
Pick the simplest option, document WHY, move forward. You can change it later.

### Strategy 4: Check User Impact
Which option would confuse users LESS? Pick that one.

### Strategy 5: Check the Data
Look at your actual projects/milestones. Which rule makes more sense for your real use cases?

---

## Remember

**You already have good foundations:**
- Domain rules exist
- Calculations are organized
- Documentation is comprehensive

**You're not starting from scratch** - you're REFINING and CONSOLIDATING.

**Your domain knowledge is the key** - the code can't tell you what the business rules SHOULD be. Trust your judgment.

**This is iterative** - You don't need to solve everything at once.

---

Good luck! You've got this. 🚀

**End of Logic Consolidation Process Guide v1.0.0**
