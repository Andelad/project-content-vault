# Milestone vs Calendar Event Clarification

## Critical Business Logic Distinction

**Last Updated**: October 20, 2025  
**Status**: Authoritative Reference

---

## The Fundamental Difference

### **Milestones = Forecasting Tools**
- **NOT tasks or work items**
- Define time allocation segments for capacity planning
- Drive day estimate calculations
- **Cannot be marked complete**
- Used to answer: "How much time should I allocate for this work?"

### **Calendar Events = Actual Work**
- Represent scheduled or completed work sessions
- Track time spent on projects
- **Can be marked complete**
- Used to answer: "What work did I actually do?"

---

## User Workflow

1. **Create Project**: "Build website for client" (100 hours total)

2. **Add Milestones** (forecasting):
   - "Design phase": 30 hours, March 1-15
   - "Development phase": 50 hours, March 16-31
   - "Testing phase": 20 hours, April 1-10

3. **System Calculates Day Estimates**:
   - March 10: "You need 2 hours for Design phase"
   - March 25: "You need 3.5 hours for Development phase"
   - April 5: "You need 2 hours for Testing phase"

4. **User Schedules Calendar Events** (based on estimates):
   - March 10, 9am-11am: "Design homepage mockup" (planned event)
   - March 25, 1pm-4:30pm: "Build contact form" (planned event)

5. **User Completes Work**:
   - March 10: Mark "Design homepage mockup" as ✓ complete
   - March 25: Mark "Build contact form" as ✓ complete
   - **Milestones are NOT marked complete** - they remain as allocation guides

---

## Recurring Patterns

### **Recurring Milestones** (virtual instances)
Example: "Weekly status report - 2 hours every Friday"
- Pattern stored in database
- System generates virtual instances during day estimate calculations
- User sees: "Need 2h on Friday, March 15", "Need 2h on Friday, March 22", etc.
- Used for forecasting only

### **Recurring Calendar Events** (actual work patterns)
Example: "Team standup - 30 minutes every weekday 9am"
- Actual events created in calendar
- Can mark each occurrence as complete
- Tracks actual time spent

---

## Technical Implementation

### Milestone Storage (Option B: Virtual Instances)
```typescript
// Database stores template
{
  id: "milestone-123",
  name: "Weekly status report",
  projectId: "project-456",
  timeAllocationHours: 2,
  isRecurring: true,
  recurringConfig: {
    type: "weekly",
    interval: 1,
    weeklyDayOfWeek: 5 // Friday
  }
}

// Day estimate service generates virtual instances
// No separate milestone_instances table needed
// Pattern evaluated on-the-fly during calculations
```

### Calendar Event Storage (Actual Records)
```typescript
// Each event is a real database record
{
  id: "event-789",
  title: "Design homepage mockup",
  startTime: "2025-03-10T09:00:00Z",
  endTime: "2025-03-10T11:00:00Z",
  projectId: "project-456",
  completed: true // CAN BE MARKED COMPLETE
}
```

---

## Why This Matters

**Before clarification**: AI assumed milestones were completable tasks
- Tried to add completion tracking to milestones
- Confused forecasting with actual work tracking
- Proposed separate instances table unnecessarily

**After clarification**: Clear separation of concerns
- Milestones = budget/capacity planning
- Events = actual work tracking
- No completion status on milestones
- Virtual instance generation for recurring patterns

---

## Key Takeaways

1. **Milestones answer**: "How should I budget my time?"
2. **Calendar Events answer**: "What work did I actually do?"
3. **Only Events can be completed** (milestones are perpetual forecasts)
4. **Recurring milestones use virtual instances** (no separate table)
5. **Day estimates bridge the gap** (forecast → actual scheduling)

---

## See Also
- [Business Logic Reference](./BUSINESS_LOGIC_REFERENCE.md)
- [Milestone System Analysis](./MILESTONE_SYSTEM_ANALYSIS.md)
- [Domain Rules: MilestoneRules.ts](../src/domain/rules/MilestoneRules.ts)
