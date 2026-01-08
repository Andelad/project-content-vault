# Architecture Stage 2: Tightening the Foundation

**Created:** January 7, 2026  
**Status:** 🎯 **READY TO EXECUTE**  
**Purpose:** Eliminate remaining architectural inconsistencies that block clear bug fixing

---

## 🎯 MISSION

**Stage 1 Achievement (Complete):**
- ✅ Three-layer architecture established
- ✅ Business logic consolidated in `domain/rules/`
- ✅ 5+ overlapping layers → 3 clear layers
- ✅ `unified/` and `domain-services/` deleted

**Stage 2 Goal:**
**Make it IMPOSSIBLE to be confused about where bugs live and where to fix them.**

---

## 🚨 THE PROBLEM

Despite Stage 1's success, **bugs can still hide** due to:

1. **Orchestrators doing business logic** instead of delegating to rules
2. **UI components bypassing orchestrators** (direct database access)
3. **Incomplete domain rules** (TODOs, missing validation)
4. **Calculations not migrated** (recurring events, time tracking)
5. **No enforcement mechanism** (nothing prevents violations)

**When you try to fix a bug:**
- Logic might be in orchestrator OR domain rules (check both?)
- Validation might be incomplete (TODO comments)
- UI might bypass the whole system (direct Supabase calls)

**Stage 2 fixes this.**

---

## 📊 STAGE 2 SCOPE

| Area | Issue | Fix | Estimated Time |
|------|-------|-----|----------------|
| **Phase Orchestrator** | Budget logic inline | Extract to `PhaseBudget` | 3 hours |
| **Phase Orchestrator** | Recurring calculations inline | Extract to `PhaseRecurrence` | 2 hours |
| **Phase Orchestrator** | Date conflict detection | Extract to `PhaseValidation` | 1 hour |
| **Recurring Events** | Not using domain rules | Create `EventRecurrence` | 4 hours |
| **Time Tracking** | Duration calcs inline | Extract to `TimeTracking` rules | 3 hours |
| **Feedback Modal** | Direct DB access | Create `FeedbackOrchestrator` | 2 hours |
| **Phase Validation** | TODOs for budget checks | Complete implementation | 2 hours |
| **Event Integration** | Import TODOs | Fix references | 1 hour |
| **Holiday Orchestrator** | Validation & overlap logic | Extract to `HolidayValidation` | 3 hours |
| **Group Orchestrator** | Validation logic inline | Extract to `GroupValidation` | 2 hours |
| **Calendar Event Orch** | Form validation inline | Extract to `EventValidation` | 2 hours |
| **Calendar Event Orch** | Duration calculation | Extract to `EventValidation` | 1 hour |
| **Project Orchestrator** | Date conflict detection | Extract to `ProjectValidation` | 2 hours |
| **Project Orchestrator** | Budget analysis logic | Extract to `ProjectBudget` | 2 hours |
| **Timeline Orchestrator** | Allocation classification | Extract to `TimelineDisplay` | 2 hours |
| **Enforcement** | None | Add dev-time warnings | 3 hours |
| **Documentation** | Cleanup | Remove deprecated markers | 1 hour |

**Total Estimated Time:** 36 hours (~5 days of focused work)

---

## 📅 EXECUTION PLAN

### **Task 1: Extract PhaseOrchestrator Business Logic** (3 hours)

**Current Problem:**
```typescript
// PhaseOrchestrator.ts - Lines 215-226
// ❌ Budget validation logic in orchestrator
const currentAllocation = existingPhases.reduce((sum, phase) => 
  sum + (phase.timeAllocationHours || phase.timeAllocation), 0
);
const newAllocation = currentAllocation + (milestone.timeAllocationHours || 0);

if (newAllocation > project.estimatedHours) {
  conflicts.push(`Would exceed project budget by ${newAllocation - project.estimatedHours} hours`);
}
```

**Solution:**

**Step 1.1:** Add method to `domain/rules/phases/PhaseBudget.ts`
```typescript
/**
 * Validate milestone scheduling against budget constraints
 * 
 * @param existingPhases - Current phases in project
 * @param newMilestone - Milestone being scheduled
 * @param projectBudget - Total project budget in hours
 * @returns Validation result with specific budget conflicts
 */
static validateMilestoneScheduling(
  existingPhases: PhaseDTO[],
  newMilestone: Partial<PhaseDTO>,
  projectBudget: number
): {
  canSchedule: boolean;
  budgetConflicts: string[];
  currentAllocation: number;
  newAllocation: number;
} {
  const currentAllocation = existingPhases.reduce(
    (sum, phase) => sum + (phase.timeAllocationHours || phase.timeAllocation || 0), 
    0
  );
  
  const newAllocation = currentAllocation + (
    newMilestone.timeAllocationHours || 
    newMilestone.timeAllocation || 
    0
  );
  
  const budgetConflicts: string[] = [];
  
  if (newAllocation > projectBudget) {
    budgetConflicts.push(
      `Would exceed project budget by ${newAllocation - projectBudget} hours`
    );
  }
  
  return {
    canSchedule: budgetConflicts.length === 0,
    budgetConflicts,
    currentAllocation,
    newAllocation
  };
}
```

**Step 1.2:** Update PhaseOrchestrator to delegate
```typescript
// PhaseOrchestrator.ts - Update checkMilestoneSchedulingFeasibility method
import { PhaseBudget } from '@/domain/rules/phases/PhaseBudget';

private static checkMilestoneSchedulingFeasibility(
  project: Project,
  existingPhases: PhaseDTO[],
  milestone: Partial<PhaseDTO>
): { canSchedule: boolean; conflicts: string[] } {
  const conflicts: string[] = [];
  
  const requestedDate = new Date(milestone.endDate || milestone.dueDate!);
  const projectStart = new Date(project.startDate);
  const projectEnd = new Date(project.endDate);
  
  // 1. Verify milestone fits within project timeframe
  if (requestedDate < projectStart || requestedDate > projectEnd) {
    conflicts.push('Milestone date must be within project timeframe');
  }

  // 2. Check for date conflicts with existing milestones
  const hasDateConflict = existingPhases.some(phase => {
    const existingDate = new Date(phase.endDate || phase.dueDate);
    return Math.abs(existingDate.getTime() - requestedDate.getTime()) < (24 * 60 * 60 * 1000);
  });

  if (hasDateConflict) {
    conflicts.push('Another milestone already exists on or near this date');
  }

  // 3. ✅ Budget validation - DELEGATE to domain rules
  const budgetCheck = PhaseBudget.validateMilestoneScheduling(
    existingPhases,
    milestone,
    project.estimatedHours
  );
  
  conflicts.push(...budgetCheck.budgetConflicts);

  return {
    canSchedule: conflicts.length === 0,
    conflicts
  };
}
```

**Verification:**
- [ ] Budget logic exists in ONE place only (`PhaseBudget`)
- [ ] Orchestrator delegates to domain rules
- [ ] Tests pass
- [ ] No compilation errors

---

### **Task 2: Extract Recurring Calculation Logic** (2 hours)

**Current Problem:**
```typescript
// PhaseOrchestrator.ts - Lines 543-559
// ❌ Recurring milestone calculations in orchestrator
private static calculateEstimatedMilestoneCount(
  config: ProjectRecurringPhaseConfig,
  projectDurationDays: number
): number {
  switch (config.recurringType) {
    case 'daily':
      return Math.floor(projectDurationDays / config.recurringInterval);
    case 'weekly':
      return Math.floor(projectDurationDays / (7 * config.recurringInterval));
    case 'monthly':
      return Math.floor(projectDurationDays / (30 * config.recurringInterval));
    default:
      return 0;
  }
}
```

**Solution:**

**Step 2.1:** Add to `domain/rules/phases/PhaseRecurrence.ts`
```typescript
/**
 * Estimate number of recurring occurrences within a duration
 * 
 * @param config - Recurrence configuration
 * @param durationDays - Duration in days
 * @returns Estimated occurrence count
 */
static estimateOccurrenceCount(
  config: { recurringType: string; recurringInterval: number },
  durationDays: number
): number {
  switch (config.recurringType) {
    case 'daily':
      return Math.floor(durationDays / config.recurringInterval);
    case 'weekly':
      return Math.floor(durationDays / (7 * config.recurringInterval));
    case 'monthly':
      return Math.floor(durationDays / (30 * config.recurringInterval));
    case 'yearly':
      return Math.floor(durationDays / (365 * config.recurringInterval));
    default:
      return 0;
  }
}
```

**Step 2.2:** Update PhaseOrchestrator
```typescript
// PhaseOrchestrator.ts - Update method
private static calculateEstimatedMilestoneCount(
  config: ProjectRecurringPhaseConfig,
  projectDurationDays: number
): number {
  // ✅ Delegate to domain rules
  return PhaseRecurrenceService.estimateOccurrenceCount(
    {
      recurringType: config.recurringType,
      recurringInterval: config.recurringInterval
    },
    projectDurationDays
  );
}
```

**Verification:**
- [ ] Calculation logic in domain rules only
- [ ] Orchestrator is thin delegation
- [ ] Tests pass

---

### **Task 3: Migrate Recurring Events to Domain Rules** (4 hours)

**Current Problem:**
```typescript
// recurringEventsOrchestrator.ts - Lines 156-200
// ❌ Inline recurrence calculations (not using domain rules pattern)
function calculateNextOccurrence(date, type, interval) {
  let nextDate = new Date(date);
  
  switch (type) {
    case 'daily':
      nextDate = addDaysToDate(nextDate, interval);
      break;
    case 'weekly':
      nextDate = addDaysToDate(nextDate, 7 * interval);
      break;
    // ... 25+ lines
  }
  
  return nextDate;
}

function calculateEventsNeeded(startDate, targetDate, type, interval) {
  // ... more inline calculations
}
```

**Solution:**

**Step 3.1:** Create `domain/rules/events/EventRecurrence.ts`
```typescript
/**
 * Event Recurrence Rules
 * 
 * Business logic for recurring calendar events.
 * Follows the same pattern as PhaseRecurrence.
 * 
 * Co-located calculations (no separate utilities):
 * - Next occurrence calculation
 * - Occurrence count estimation
 * - Recurrence pattern validation
 */

import { addDaysToDate } from '@/utils/dateCalculations';

export interface RecurringEventConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
}

export class EventRecurrence {
  /**
   * Calculate next occurrence date for a recurring event
   * 
   * @param baseDate - Current occurrence date
   * @param config - Recurrence configuration
   * @returns Next occurrence date
   */
  static calculateNextOccurrence(
    baseDate: Date,
    config: RecurringEventConfig
  ): Date {
    let nextDate = new Date(baseDate);
    
    switch (config.type) {
      case 'daily':
        nextDate = addDaysToDate(nextDate, config.interval);
        break;
      case 'weekly':
        nextDate = addDaysToDate(nextDate, 7 * config.interval);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + config.interval);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + config.interval);
        break;
    }
    
    return nextDate;
  }

  /**
   * Estimate how many recurring events needed to reach target date
   * 
   * @param startDate - First occurrence
   * @param targetDate - Target end date
   * @param config - Recurrence configuration
   * @returns Estimated event count
   */
  static estimateEventsNeeded(
    startDate: Date,
    targetDate: Date,
    config: RecurringEventConfig
  ): number {
    const diffMs = targetDate.getTime() - startDate.getTime();
    
    switch (config.type) {
      case 'daily':
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24 * config.interval));
      case 'weekly':
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7 * config.interval));
      case 'monthly':
        // Approximate - will be adjusted by actual date calculations
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30 * config.interval));
      case 'yearly':
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 365 * config.interval));
      default:
        return 10; // Fallback
    }
  }

  /**
   * Validate recurrence configuration
   * 
   * @param config - Recurrence configuration to validate
   * @returns Validation result
   */
  static validateConfig(
    config: RecurringEventConfig
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(config.type)) {
      errors.push('Invalid recurrence type');
    }
    
    if (config.interval < 1) {
      errors.push('Recurrence interval must be at least 1');
    }
    
    if (config.interval > 365) {
      errors.push('Recurrence interval cannot exceed 365');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
```

**Step 3.2:** Update `domain/rules/events/index.ts`
```typescript
export * from './EventValidation';
export * from './EventClassification';
export * from './EventRecurrence'; // Add new export
```

**Step 3.3:** Refactor `recurringEventsOrchestrator.ts`
```typescript
import { EventRecurrence } from '@/domain/rules/events/EventRecurrence';

// Replace inline functions with domain rule calls
export async function ensureRecurringEventsExist(
  recurringEvent: CalendarEvent,
  currentEvents: CalendarEvent[]
): Promise<number> {
  try {
    // ✅ Use domain rules for validation
    const config = {
      type: recurringEvent.recurringType as 'daily' | 'weekly' | 'monthly' | 'yearly',
      interval: recurringEvent.recurringInterval || 1
    };
    
    const validation = EventRecurrence.validateConfig(config);
    if (!validation.isValid) {
      console.error('Invalid recurring config:', validation.errors);
      return 0;
    }

    // ✅ Use domain rules for calculations
    const now = new Date();
    const futureDate = addDaysToDate(now, 90);
    
    const eventsNeeded = EventRecurrence.estimateEventsNeeded(
      new Date(recurringEvent.date),
      futureDate,
      config
    );
    
    // ... rest of orchestration logic
    
    let currentDate = new Date(recurringEvent.date);
    for (let i = 0; i < eventsNeeded; i++) {
      currentDate = EventRecurrence.calculateNextOccurrence(currentDate, config);
      // ... create event
    }
    
    return eventsCreated;
  } catch (error) {
    ErrorHandlingService.handle(error, { 
      source: 'recurringEventsOrchestrator', 
      action: 'Error ensuring recurring events exist:' 
    });
    return 0;
  }
}

// ✅ DELETE these inline functions (now in domain rules):
// - calculateNextOccurrence (moved to EventRecurrence)
// - calculateEventsNeeded (moved to EventRecurrence)
```

**Verification:**
- [ ] `EventRecurrence.ts` created in `domain/rules/events/`
- [ ] Orchestrator uses domain rules
- [ ] Inline functions deleted
- [ ] Tests pass

---

### **Task 4: Extract Time Tracking Calculations** (3 hours)

**Current Problem:**
```typescript
// timeTrackingOrchestrator.ts - Lines 529, 630, 764
// ❌ Duration calculations inline in orchestrator
const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
const duration = (actualStopTime.getTime() - startTimeRef.current.getTime()) / (1000 * 60 * 60);
```

**Solution:**

**Step 4.1:** Add to `domain/rules/time-tracking/TimeEntryCalculation.ts`
```typescript
/**
 * Time Entry Calculation Rules
 * 
 * Business logic for time tracking calculations.
 * Co-located math (no separate utilities).
 */

export class TimeEntryCalculation {
  /**
   * Calculate elapsed seconds from start time to now
   * 
   * @param startTime - When tracking started
   * @returns Elapsed seconds
   */
  static calculateElapsedSeconds(startTime: Date): number {
    return Math.floor((Date.now() - startTime.getTime()) / 1000);
  }

  /**
   * Calculate duration in hours between two timestamps
   * 
   * @param startTime - Start timestamp
   * @param endTime - End timestamp
   * @returns Duration in hours (decimal)
   */
  static calculateDurationHours(startTime: Date, endTime: Date): number {
    return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Calculate billable hours based on entry and project settings
   * 
   * @param duration - Duration in hours
   * @param isBillable - Whether time is billable
   * @returns Billable hours
   */
  static calculateBillableHours(duration: number, isBillable: boolean): number {
    return isBillable ? duration : 0;
  }

  /**
   * Validate time entry duration
   * 
   * @param duration - Duration in hours
   * @returns Validation result
   */
  static validateDuration(duration: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (duration < 0) {
      errors.push('Duration cannot be negative');
    }
    
    if (duration > 24) {
      errors.push('Duration cannot exceed 24 hours');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
```

**Step 4.2:** Update orchestrator to delegate
```typescript
// timeTrackingOrchestrator.ts
import { TimeEntryCalculation } from '@/domain/rules/time-tracking/TimeEntryCalculation';

// Replace inline calculations:
// Before:
const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);

// After:
const elapsed = TimeEntryCalculation.calculateElapsedSeconds(startTimeRef.current);

// Before:
const duration = (actualStopTime.getTime() - startTimeRef.current.getTime()) / (1000 * 60 * 60);

// After:
const duration = TimeEntryCalculation.calculateDurationHours(startTimeRef.current, actualStopTime);
```

**Verification:**
- [ ] Time calculations in domain rules
- [ ] Orchestrator delegates
- [ ] No inline duration math
- [ ] Tests pass

---

### **Task 5: Create FeedbackOrchestrator** (2 hours)

**Current Problem:**
```typescript
// FeedbackModal.tsx - Lines 88-131
// ❌ Direct database access from UI component
await supabase.from('feedback').insert({...})
await supabase.storage.from('feedback-attachments').upload(...)
```

**Solution:**

**Step 5.1:** Create `domain/rules/feedback/FeedbackValidation.ts`
```typescript
/**
 * Feedback Validation Rules
 * 
 * Business logic for feedback submission validation.
 */

export interface FeedbackInput {
  usageContext: string;
  feedbackType: string;
  feedbackText: string;
  attachments?: File[];
}

export class FeedbackValidation {
  /**
   * Validate feedback submission
   */
  static validateSubmission(input: FeedbackInput): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (!input.feedbackText || input.feedbackText.trim().length === 0) {
      errors.push('Feedback text is required');
    }
    
    if (input.feedbackText && input.feedbackText.length > 5000) {
      errors.push('Feedback text cannot exceed 5000 characters');
    }
    
    if (input.attachments && input.attachments.length > 5) {
      errors.push('Maximum 5 attachments allowed');
    }
    
    if (input.attachments) {
      for (const file of input.attachments) {
        if (file.size > 10 * 1024 * 1024) { // 10MB
          errors.push(`File ${file.name} exceeds 10MB limit`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
```

**Step 5.2:** Create `services/orchestrators/FeedbackOrchestrator.ts`
```typescript
/**
 * Feedback Orchestrator
 * 
 * Handles feedback submission workflow including validation and file uploads.
 */

import { supabase } from '@/integrations/supabase/client';
import { FeedbackValidation, type FeedbackInput } from '@/domain/rules/feedback/FeedbackValidation';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

export class FeedbackOrchestrator {
  /**
   * Submit user feedback with optional attachments
   */
  static async submitFeedback(
    input: FeedbackInput
  ): Promise<{ success: boolean; errors?: string[] }> {
    try {
      // ✅ Validate via domain rules
      const validation = FeedbackValidation.validateSubmission(input);
      if (!validation.isValid) {
        return { success: false, errors: validation.errors };
      }
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Insert feedback into database
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback')
        .insert({
          user_id: user?.id,
          usage_context: input.usageContext,
          feedback_type: input.feedbackType,
          feedback_text: input.feedbackText,
          user_email: user?.email,
          user_agent: navigator.userAgent,
          url: window.location.href
        })
        .select()
        .single();

      if (feedbackError) throw feedbackError;

      // Upload attachments if any
      if (input.attachments && input.attachments.length > 0 && feedbackData) {
        await this.uploadAttachments(feedbackData.id, input.attachments, user?.id);
      }

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'FeedbackOrchestrator', 
        action: 'Error submitting feedback:' 
      });
      return { 
        success: false, 
        errors: ['Failed to submit feedback. Please try again.'] 
      };
    }
  }

  /**
   * Upload feedback attachments
   * @private
   */
  private static async uploadAttachments(
    feedbackId: string,
    attachments: File[],
    userId?: string
  ): Promise<void> {
    for (const file of attachments) {
      const filePath = `${userId}/${feedbackId}/${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('feedback-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Generate signed URL (expires in 7 days)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('feedback-attachments')
        .createSignedUrl(filePath, 604800);

      if (signedUrlError) throw signedUrlError;

      // Save attachment metadata
      const { error: attachmentError } = await supabase
        .from('feedback_attachments')
        .insert({
          feedback_id: feedbackId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          storage_url: signedUrlData.signedUrl
        });

      if (attachmentError) throw attachmentError;
    }
  }
}
```

**Step 5.3:** Update `FeedbackModal.tsx`
```typescript
import { FeedbackOrchestrator } from '@/services/orchestrators/FeedbackOrchestrator';

const handleSubmit = async () => {
  if (!feedbackText.trim()) {
    toast({
      title: "Error",
      description: "Please enter your feedback.",
      variant: "destructive",
    });
    return;
  }

  setLoading(true);

  try {
    // ✅ Use orchestrator
    const result = await FeedbackOrchestrator.submitFeedback({
      usageContext,
      feedbackType,
      feedbackText,
      attachments
    });

    if (!result.success) {
      toast({
        title: "Error",
        description: result.errors?.join(', ') || "Failed to submit feedback",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Feedback submitted!",
      description: "Thank you for your feedback. We'll review it soon.",
    });

    // Reset form and close modal
    setUsageContext('university');
    setFeedbackType('like');
    setFeedbackText('');
    setAttachments([]);
    onOpenChange(false);
  } catch (error) {
    ErrorHandlingService.handle(error, { 
      source: 'FeedbackModal', 
      action: 'Error submitting feedback:' 
    });
    toast({
      title: "Error",
      description: "An unexpected error occurred. Please try again.",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};
```

**Verification:**
- [ ] FeedbackValidation rules created
- [ ] FeedbackOrchestrator created
- [ ] FeedbackModal uses orchestrator
- [ ] No direct Supabase calls in UI
- [ ] Tests pass

---

### **Task 6: Extract HolidayOrchestrator Business Logic** (3 hours)

**Current Problem:**
```typescript
// HolidayOrchestrator.ts - Lines 56-101
// ❌ Validation logic in orchestrator
validateHolidayData(formData: HolidayFormData): HolidayValidationResult {
  if (!formData.title.trim()) {
    return { isValid: false, hasOverlaps: false, error: 'Holiday title is required' };
  }
  
  if (formData.startDate > formData.endDate) {
    return { isValid: false, hasOverlaps: false, error: 'Start date cannot be after end date' };
  }
  
  // Check for overlaps
  const overlappingHolidays = this.findOverlappingHolidays(formData.startDate, formData.endDate);
  // ... overlap logic
}

// Lines 220-270
// ❌ Overlap detection and date adjustment logic
private findOverlappingHolidays(startDate: Date, endDate: Date): Holiday[] {
  return this.existingHolidays.filter(holiday => {
    return startDate <= holiday.endDate && holiday.startDate <= endDate;
  });
}

private calculateAdjustedDates(startDate, endDate, overlappingHolidays) {
  // ... 50 lines of date adjustment logic
}
```

**Solution:**

**Step 6.1:** Create `domain/rules/holidays/HolidayValidation.ts`
```typescript
/**
 * Holiday Validation Rules
 * 
 * Business logic for holiday data validation and conflict resolution.
 */

import type { Holiday } from '@/types/core';

export interface HolidayOverlapResult {
  hasOverlaps: boolean;
  overlappingHolidays: Holiday[];
  adjustedDates?: {
    startDate: Date;
    endDate: Date;
    adjustmentMessage: string;
  };
}

export class HolidayValidation {
  /**
   * Validate basic holiday data
   */
  static validateBasicData(
    title: string,
    startDate: Date,
    endDate: Date
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!title || title.trim().length === 0) {
      errors.push('Holiday title is required');
    }
    
    if (title && title.length > 200) {
      errors.push('Holiday title cannot exceed 200 characters');
    }
    
    if (!startDate || !endDate) {
      errors.push('Start date and end date are required');
    }
    
    if (startDate && endDate && startDate > endDate) {
      errors.push('Start date cannot be after end date');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Find overlapping holidays
   * 
   * @param startDate - New holiday start date
   * @param endDate - New holiday end date
   * @param existingHolidays - All existing holidays
   * @param excludeId - Holiday ID to exclude (for updates)
   * @returns Array of overlapping holidays
   */
  static findOverlaps(
    startDate: Date,
    endDate: Date,
    existingHolidays: Holiday[],
    excludeId?: string
  ): Holiday[] {
    return existingHolidays.filter(holiday => {
      // Skip the current holiday if editing
      if (excludeId && holiday.id === excludeId) {
        return false;
      }
      
      // Check if dates overlap (inline date math)
      return startDate <= holiday.endDate && holiday.startDate <= endDate;
    });
  }

  /**
   * Calculate adjusted dates to resolve overlaps
   * 
   * @param startDate - Requested start date
   * @param endDate - Requested end date
   * @param overlappingHolidays - Conflicting holidays
   * @returns Adjusted dates that avoid overlaps
   */
  static calculateAdjustedDates(
    startDate: Date,
    endDate: Date,
    overlappingHolidays: Holiday[]
  ): {
    startDate: Date;
    endDate: Date;
    adjustmentMessage: string;
  } {
    let adjustedStartDate = new Date(startDate);
    let adjustedEndDate = new Date(endDate);
    let adjustmentMessage = '';
    
    // Check if start date overlaps - move it after the conflicting holiday
    const startOverlap = overlappingHolidays.find(h => 
      startDate <= h.endDate && startDate >= h.startDate
    );
    
    if (startOverlap) {
      // Move to day after overlapping holiday ends (inline date math)
      adjustedStartDate = new Date(startOverlap.endDate);
      adjustedStartDate.setDate(adjustedStartDate.getDate() + 1);
      adjustmentMessage = `Start date moved to ${adjustedStartDate.toDateString()} (after "${startOverlap.title}")`;
    }
    
    // Check if end date overlaps - move it before the conflicting holiday
    const endOverlap = overlappingHolidays.find(h => 
      endDate >= h.startDate && endDate <= h.endDate
    );
    
    if (endOverlap && !startOverlap) {
      // Move to day before overlapping holiday starts (inline date math)
      adjustedEndDate = new Date(endOverlap.startDate);
      adjustedEndDate.setDate(adjustedEndDate.getDate() - 1);
      adjustmentMessage = `End date moved to ${adjustedEndDate.toDateString()} (before "${endOverlap.title}")`;
    }

    return {
      startDate: adjustedStartDate,
      endDate: adjustedEndDate,
      adjustmentMessage
    };
  }

  /**
   * Complete validation including overlap detection
   */
  static validateHoliday(
    title: string,
    startDate: Date,
    endDate: Date,
    existingHolidays: Holiday[],
    excludeId?: string
  ): {
    isValid: boolean;
    errors: string[];
    hasOverlaps: boolean;
    overlaps?: Holiday[];
    suggestedDates?: { startDate: Date; endDate: Date; message: string };
  } {
    // Basic validation
    const basicValidation = this.validateBasicData(title, startDate, endDate);
    if (!basicValidation.isValid) {
      return {
        isValid: false,
        errors: basicValidation.errors,
        hasOverlaps: false
      };
    }
    
    // Overlap detection
    const overlaps = this.findOverlaps(startDate, endDate, existingHolidays, excludeId);
    
    if (overlaps.length > 0) {
      const adjusted = this.calculateAdjustedDates(startDate, endDate, overlaps);
      return {
        isValid: false,
        errors: ['Holiday dates overlap with existing holidays'],
        hasOverlaps: true,
        overlaps,
        suggestedDates: {
          startDate: adjusted.startDate,
          endDate: adjusted.endDate,
          message: adjusted.adjustmentMessage
        }
      };
    }
    
    return {
      isValid: true,
      errors: [],
      hasOverlaps: false
    };
  }
}
```

**Step 6.2:** Update `domain/rules/holidays/index.ts`
```typescript
export * from './HolidayValidation';
// export * from './HolidayRecurrence'; // Future
```

**Step 6.3:** Refactor HolidayOrchestrator to delegate
```typescript
import { HolidayValidation } from '@/domain/rules/holidays/HolidayValidation';

export class HolidayOrchestrator {
  validateHolidayData(formData: HolidayFormData): HolidayValidationResult {
    // ✅ Delegate to domain rules
    const validation = HolidayValidation.validateHoliday(
      formData.title,
      formData.startDate,
      formData.endDate,
      this.existingHolidays,
      this.currentHolidayId
    );
    
    if (!validation.isValid) {
      return {
        isValid: false,
        hasOverlaps: validation.hasOverlaps,
        error: validation.errors[0],
        overlappingHolidays: validation.overlaps,
        adjustedDates: validation.suggestedDates
      };
    }
    
    return {
      isValid: true,
      hasOverlaps: false
    };
  }

  // ✅ DELETE these private methods (now in domain rules):
  // - findOverlappingHolidays
  // - calculateAdjustedDates
}
```

**Verification:**
- [ ] HolidayValidation created in domain/rules/holidays/
- [ ] All validation logic in domain rules
- [ ] Orchestrator delegates to domain rules
- [ ] Private methods deleted from orchestrator
- [ ] Tests pass

---

### **Task 7: Extract GroupOrchestrator Validation** (2 hours)

**Current Problem:**
```typescript
// GroupOrchestrator.ts - Lines 85-120
// ❌ Validation logic in orchestrator
static validateGroupUpdate(
  request: GroupUpdateRequest,
  currentGroup: Group
): GroupValidationResult {
  const errors: string[] = [];
  
  if (!request.id || request.id.trim().length === 0) {
    errors.push('Group ID is required for updates');
  }
  
  if (request.name !== undefined) {
    if (!request.name || request.name.trim().length === 0) {
      errors.push('Group name cannot be empty');
    } else if (request.name.trim().length > 100) {
      errors.push('Group name cannot exceed 100 characters');
    }
  }
  
  // Business rule: Prevent modification of system groups
  if (currentGroup.id === 'work-group' || currentGroup.id === 'home-group') {
    if (request.name && request.name !== currentGroup.name) {
      warnings.push('Modifying system group names may affect default workflows');
    }
  }
  
  return { isValid: errors.length === 0, errors, warnings };
}
```

**Solution:**

**Step 7.1:** Create `domain/rules/groups/GroupValidation.ts`
```typescript
/**
 * Group Validation Rules
 * 
 * Business logic for group validation.
 */

import type { Group } from '@/types/core';

export class GroupValidation {
  /**
   * Validate group creation data
   */
  static validateCreate(name: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!name || name.trim().length === 0) {
      errors.push('Group name is required');
    }
    
    if (name && name.trim().length > 100) {
      errors.push('Group name cannot exceed 100 characters');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate group update data
   */
  static validateUpdate(
    groupId: string,
    name: string | undefined,
    currentGroup: Group
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!groupId || groupId.trim().length === 0) {
      errors.push('Group ID is required for updates');
    }
    
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        errors.push('Group name cannot be empty');
      } else if (name.trim().length > 100) {
        errors.push('Group name cannot exceed 100 characters');
      }
    }
    
    // Business rule: System group modification warning
    if (this.isSystemGroup(currentGroup.id)) {
      if (name && name !== currentGroup.name) {
        warnings.push('Modifying system group names may affect default workflows');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if a group is a system group (cannot be deleted)
   */
  static isSystemGroup(groupId: string): boolean {
    return groupId === 'work-group' || groupId === 'home-group';
  }

  /**
   * Validate group deletion
   */
  static validateDelete(group: Group): {
    canDelete: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (this.isSystemGroup(group.id)) {
      errors.push('System groups (work-group, home-group) cannot be deleted');
    }
    
    return {
      canDelete: errors.length === 0,
      errors
    };
  }
}
```

**Step 7.2:** Update orchestrator
```typescript
import { GroupValidation } from '@/domain/rules/groups/GroupValidation';

export class GroupOrchestrator {
  static validateGroupUpdate(
    request: GroupUpdateRequest,
    currentGroup: Group
  ): GroupValidationResult {
    // ✅ Delegate to domain rules
    return GroupValidation.validateUpdate(
      request.id,
      request.name,
      currentGroup
    );
  }

  static async deleteGroup(groupId: string, group: Group) {
    // ✅ Use domain rules for validation
    const validation = GroupValidation.validateDelete(group);
    if (!validation.canDelete) {
      return { success: false, errors: validation.errors };
    }
    
    // ... orchestration logic
  }
}
```

**Verification:**
- [ ] GroupValidation created
- [ ] Orchestrator delegates
- [ ] Tests pass

---

### **Task 8: Extract CalendarEventOrchestrator Validation** (3 hours)

**Current Problem:**
```typescript
// CalendarEventOrchestrator.ts - Lines 56-95
// ❌ Form validation in orchestrator
validateEventForm(formData: EventFormData): EventFormErrors {
  const errors: EventFormErrors = {};

  if (!formData.startDate || !formData.startTime) {
    errors.startDateTime = 'Start date and time are required';
  }

  if (formData.startDate && formData.startTime && formData.endDate && formData.endTime) {
    const startDateTime = this.parseDateTime(formData.startDate, formData.startTime);
    const endDateTime = this.parseDateTime(formData.endDate, formData.endTime);

    if (startDateTime >= endDateTime) {
      errors.endDateTime = 'End time must be after start time';
    }
  }

  if (formData.isRecurring && formData.recurringEndType === 'date' && !formData.recurringEndDate) {
    errors.recurringEndDate = 'End date is required for recurring events';
  }

  // ... duration calculation in transformFormToEventData
  const duration = this.calculateDurationHours(startDateTime, endDateTime);
}
```

**Solution:**

**Step 8.1:** Add to `domain/rules/events/EventValidation.ts`
```typescript
/**
 * Validate event form data
 */
static validateEventForm(
  startDate: Date | null,
  startTime: string | null,
  endDate: Date | null,
  endTime: string | null,
  isRecurring: boolean,
  recurringEndType?: string,
  recurringEndDate?: Date | null,
  recurringInterval?: number
): {
  isValid: boolean;
  errors: {
    startDateTime?: string;
    endDateTime?: string;
    recurringEndDate?: string;
    recurringInterval?: string;
  };
} {
  const errors: any = {};

  if (!startDate || !startTime) {
    errors.startDateTime = 'Start date and time are required';
  }

  if (!endDate || !endTime) {
    errors.endDateTime = 'End date and time are required';
  }

  if (startDate && startTime && endDate && endTime) {
    const startDateTime = this.parseDateTime(startDate, startTime);
    const endDateTime = this.parseDateTime(endDate, endTime);

    if (startDateTime >= endDateTime) {
      errors.endDateTime = 'End time must be after start time';
    }
  }

  if (isRecurring && recurringEndType === 'date' && !recurringEndDate) {
    errors.recurringEndDate = 'End date is required for recurring events';
  }

  if (isRecurring && recurringInterval && recurringInterval < 1) {
    errors.recurringInterval = 'Interval must be at least 1';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Parse date and time strings into DateTime
 */
private static parseDateTime(date: Date, time: string): Date {
  const result = new Date(date);
  const [hours, minutes] = time.split(':').map(Number);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Calculate event duration in hours
 */
static calculateDuration(startDateTime: Date, endDateTime: Date): number {
  return (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
}
```

**Step 8.2:** Update orchestrator
```typescript
import { EventValidation } from '@/domain/rules/events/EventValidation';

export class CalendarEventOrchestrator {
  validateEventForm(formData: EventFormData): EventFormErrors {
    // ✅ Delegate to domain rules
    return EventValidation.validateEventForm(
      formData.startDate,
      formData.startTime,
      formData.endDate,
      formData.endTime,
      formData.isRecurring,
      formData.recurringEndType,
      formData.recurringEndDate,
      formData.recurringInterval
    ).errors;
  }

  transformFormToEventData(formData: EventFormData): Omit<CalendarEvent, 'id'> {
    const startDateTime = EventValidation.parseDateTime(formData.startDate, formData.startTime);
    const endDateTime = EventValidation.parseDateTime(formData.endDate, formData.endTime);
    
    // ✅ Use domain rules for duration
    const duration = EventValidation.calculateDuration(startDateTime, endDateTime);
    
    // ... rest of transformation
  }
}
```

**Verification:**
- [ ] EventValidation has form validation methods
- [ ] Duration calculation in domain rules
- [ ] Orchestrator delegates
- [ ] Tests pass

---

### **Task 9: Extract ProjectOrchestrator Analysis Logic** (2 hours)

**Current Problem:**
```typescript
// ProjectOrchestrator.ts - Lines 318-360
// ❌ Budget analysis and conflict detection in orchestrator
static analyzeProjectMilestones(project: Project, phases: PhaseDTO[]): ProjectMilestoneAnalysis {
  const budgetCheck = PhaseRules.checkBudgetConstraint(phases, project.estimatedHours);
  const projectBudget: ProjectBudgetAnalysis = {
    totalAllocation: budgetCheck.totalAllocated,
    suggestedBudget: Math.max(project.estimatedHours, budgetCheck.totalAllocated),
    // ... more analysis
  };
  
  const hasOverBudgetMilestones = phases.some(p => 
    p.timeAllocation > project.estimatedHours
  );
  
  const hasDateConflicts = this.checkMilestoneDateConflicts(phases);
  
  // Generate suggestions
  const suggestions: string[] = [];
  if (projectBudget.isOverBudget) {
    suggestions.push(`Consider increasing project budget by ${projectBudget.overageHours}h`);
  }
  // ...
}
```

**Solution:**

**Step 9.1:** Add to `domain/rules/projects/ProjectBudget.ts`
```typescript
/**
 * Analyze project-phase budget relationship
 * Provides comprehensive budget health metrics
 */
static analyzeProjectPhases(
  project: Project,
  phases: PhaseDTO[]
): {
  budget: {
    totalAllocation: number;
    suggestedBudget: number;
    isOverBudget: boolean;
    overageHours: number;
    utilizationPercentage: number;
  };
  phaseMetrics: {
    totalCount: number;
    regularCount: number;
    recurringCount: number;
    hasOverBudgetPhases: boolean;
  };
  suggestions: string[];
} {
  const budgetCheck = this.checkBudgetConstraint(phases, project.estimatedHours);
  
  // Budget metrics
  const budget = {
    totalAllocation: budgetCheck.totalAllocated,
    suggestedBudget: Math.max(project.estimatedHours, budgetCheck.totalAllocated),
    isOverBudget: !budgetCheck.isValid,
    overageHours: budgetCheck.overage,
    utilizationPercentage: budgetCheck.utilizationPercentage
  };
  
  // Phase counts
  const regularCount = phases.filter(p => !p.isRecurring).length;
  const recurringCount = phases.filter(p => p.isRecurring === true).length;
  
  // Check for individual phase over-budget
  const hasOverBudgetPhases = phases.some(p => 
    (p.timeAllocationHours || p.timeAllocation || 0) > project.estimatedHours
  );
  
  // Generate suggestions
  const suggestions: string[] = [];
  
  if (budget.isOverBudget) {
    suggestions.push(
      `Consider increasing project budget by ${budget.overageHours}h or reducing phase allocations`
    );
  }
  
  if (phases.length === 0) {
    suggestions.push('Consider adding phases to track project progress');
  }
  
  if (budget.utilizationPercentage < 50) {
    suggestions.push(
      'Project has significant unallocated budget - consider adding more phases'
    );
  }
  
  return {
    budget,
    phaseMetrics: {
      totalCount: phases.length,
      regularCount,
      recurringCount,
      hasOverBudgetPhases
    },
    suggestions
  };
}
```

**Step 9.2:** Update orchestrator
```typescript
import { ProjectBudget } from '@/domain/rules/projects/ProjectBudget';

export class ProjectOrchestrator {
  static analyzeProjectMilestones(
    project: Project,
    phases: PhaseDTO[]
  ): ProjectMilestoneAnalysis {
    // ✅ Delegate analysis to domain rules
    const analysis = ProjectBudget.analyzeProjectPhases(project, phases);
    
    return {
      projectBudget: analysis.budget,
      milestoneCount: analysis.phaseMetrics.totalCount,
      regularMilestones: analysis.phaseMetrics.regularCount,
      recurringMilestones: analysis.phaseMetrics.recurringCount,
      hasOverBudgetMilestones: analysis.phaseMetrics.hasOverBudgetPhases,
      hasDateConflicts: this.checkMilestoneDateConflicts(phases), // Keep for now
      suggestions: analysis.suggestions
    };
  }
}
```

**Verification:**
- [ ] Budget analysis in domain rules
- [ ] Orchestrator delegates
- [ ] Tests pass

---

### **Task 10: Extract TimelineOrchestrator Classification** (2 hours)

**Current Problem:**
```typescript
// TimelineOrchestrator.ts - Lines 350-400
// ❌ Allocation type classification logic in orchestrator
const summariesByDate = new Map();
for (const [key, estimates] of grouped.entries()) {
  const totalHours = estimates.reduce((sum, e) => sum + (e?.hours || 0), 0);
  
  const eventEstimate = estimates.find(e => e?.source === 'event');
  let allocationType: 'planned' | 'completed' | 'auto-estimate' | 'none' = 'none';
  let isPlannedTime = false;
  let isCompletedTime = false;
  
  if (eventEstimate) {
    if (eventEstimate.isPlannedEvent && eventEstimate.isCompletedEvent) {
      allocationType = 'planned';
      isPlannedTime = true;
      isCompletedTime = true;
    } else if (eventEstimate.isPlannedEvent) {
      allocationType = 'planned';
      isPlannedTime = true;
    } else if (eventEstimate.isCompletedEvent) {
      allocationType = 'completed';
      isCompletedTime = true;
    }
  } else if (totalHours > 0) {
    allocationType = 'auto-estimate';
  }
}
```

**Solution:**

**Step 10.1:** Add to `domain/rules/timeline/TimelineDisplay.ts`
```typescript
/**
 * Classify allocation type for a day based on estimates
 * 
 * Business Rule: Events take precedence over auto-estimates
 * - If event is planned+completed → 'planned' (with both flags)
 * - If event is planned → 'planned'
 * - If event is completed → 'completed'
 * - If only auto-estimate hours → 'auto-estimate'
 * - Otherwise → 'none'
 */
static classifyDayAllocationType(
  estimates: Array<{ hours?: number; source?: string; isPlannedEvent?: boolean; isCompletedEvent?: boolean }>
): {
  allocationType: 'planned' | 'completed' | 'auto-estimate' | 'none';
  isPlannedTime: boolean;
  isCompletedTime: boolean;
  totalHours: number;
} {
  const totalHours = estimates.reduce((sum, e) => sum + (e?.hours || 0), 0);
  
  // Event takes precedence
  const eventEstimate = estimates.find(e => e?.source === 'event');
  
  let allocationType: 'planned' | 'completed' | 'auto-estimate' | 'none' = 'none';
  let isPlannedTime = false;
  let isCompletedTime = false;
  
  if (eventEstimate) {
    if (eventEstimate.isPlannedEvent && eventEstimate.isCompletedEvent) {
      allocationType = 'planned';
      isPlannedTime = true;
      isCompletedTime = true;
    } else if (eventEstimate.isPlannedEvent) {
      allocationType = 'planned';
      isPlannedTime = true;
    } else if (eventEstimate.isCompletedEvent) {
      allocationType = 'completed';
      isCompletedTime = true;
    } else {
      allocationType = 'none';
    }
  } else if (totalHours > 0) {
    allocationType = 'auto-estimate';
  }
  
  return {
    allocationType,
    isPlannedTime,
    isCompletedTime,
    totalHours
  };
}
```

**Step 10.2:** Update orchestrator
```typescript
import { TimelineDisplay } from '@/domain/rules/timeline/TimelineDisplay';

export class UnifiedTimelineService {
  static buildDaySummaries(dayEstimates: DayEstimate[]) {
    const summariesByDate = new Map();
    
    // Group by date
    const grouped = new Map();
    for (const est of dayEstimates) {
      const key = getDateKey(new Date(est.date));
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(est);
    }
    
    // Classify each day
    for (const [key, estimates] of grouped.entries()) {
      // ✅ Delegate classification to domain rules
      const classification = TimelineDisplay.classifyDayAllocationType(estimates);
      
      summariesByDate.set(key, {
        dailyHours: classification.totalHours,
        allocationType: classification.allocationType,
        isPlannedTime: classification.isPlannedTime,
        isCompletedTime: classification.isCompletedTime
      });
    }
    
    return summariesByDate;
  }
}
```

**Verification:**
- [ ] Classification logic in domain rules
- [ ] Orchestrator delegates
- [ ] Tests pass

---

### **Task 11: Complete Phase Validation TODOs** (2 hours)

**Current Problem:**
```typescript
// PhaseValidation.ts - Lines 193, 265, 274
// TODO: Re-implement this validation after ProjectBudgetService migration
// TODO: Re-implement budget validation after migration
// TODO: Re-implement budget check after migration
```

**Solution:**

**Step 6.1:** Implement the TODO budget validations
```typescript
// In PhaseValidation.ts

// Line 193 area - Replace TODO with implementation:
static validateUpdate(
  existingPhase: PhaseDTO,
  updates: Partial<PhaseDTO>,
  project: Project,
  allPhases: PhaseDTO[]
): PhaseValidationResult {
  const errors: string[] = [];
  
  // ... existing validation code ...
  
  // ✅ Budget validation (was TODO)
  if (updates.timeAllocationHours !== undefined) {
    const budgetValidation = PhaseBudget.validatePhaseAllocation(
      { ...existingPhase, ...updates },
      allPhases.filter(p => p.id !== existingPhase.id),
      project.estimatedHours
    );
    
    if (!budgetValidation.isValid) {
      errors.push(...budgetValidation.errors);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Similar pattern for other TODO locations
```

**Step 6.2:** Remove all TODO comments once implemented

**Verification:**
- [ ] No TODO comments remain in PhaseValidation.ts
- [ ] Budget validation works
- [ ] Tests pass

---

### **Task 12: Fix EventWorkHourIntegration Import TODOs** (1 hour)

**Current Problem:**
```typescript
// EventWorkHourIntegration.ts - Lines 44, 48
// TODO: Fix these imports after performance and ui services migration
// TODO: Fix this import after ui services migration
```

**Solution:**

**Step 7.1:** Review the actual imports needed
```typescript
// EventWorkHourIntegration.ts
// Check what's actually being imported and update paths

// If importing from old locations, update to:
import { /* ... */ } from '@/services/infrastructure/caching/...';
import { /* ... */ } from '@/services/ui/...';
```

**Step 7.2:** Remove TODO comments

**Verification:**
- [ ] All imports resolve correctly
- [ ] No TODO comments remain
- [ ] Tests pass

---

### **Task 13: Add Development-Time Enforcement** (3 hours)

**Goal:** Make architectural violations visible during development.

**Step 8.1:** Create enforcement utilities

Create `src/utils/architectureEnforcement.ts`:
```typescript
/**
 * Architecture Enforcement Utilities
 * 
 * Development-time checks to prevent architectural violations.
 * Only active in development mode.
 */

export class ArchitectureEnforcement {
  private static violations: Set<string> = new Set();
  
  /**
   * Initialize architecture enforcement checks
   * Call this in main.tsx during development
   */
  static initialize() {
    if (process.env.NODE_ENV !== 'development') return;
    
    console.log('🏗️  Architecture enforcement active');
    
    // Monitor for direct Supabase calls from components
    this.monitorSupabaseAccess();
    
    // Monitor for domain rules imported in components
    this.monitorDomainRuleImports();
  }
  
  /**
   * Intercept Supabase calls to detect UI bypassing orchestrators
   */
  private static monitorSupabaseAccess() {
    // This will be set up as a Supabase middleware
    // Track calls that originate from components/
  }
  
  /**
   * Check if domain rules are being imported in components
   */
  private static monitorDomainRuleImports() {
    // Use import.meta to detect imports
    // Warn when components/ imports from domain/rules/
  }
  
  /**
   * Log an architecture violation
   */
  static logViolation(
    type: 'direct_db_access' | 'domain_import' | 'business_logic_in_ui',
    details: {
      location: string;
      description: string;
      stack?: string;
    }
  ) {
    const key = `${type}:${details.location}`;
    
    if (this.violations.has(key)) return; // Don't spam
    this.violations.add(key);
    
    console.warn(
      `⚠️  ARCHITECTURE VIOLATION [${type}]\n`,
      `Location: ${details.location}\n`,
      `Issue: ${details.description}\n`,
      details.stack ? `Stack: ${details.stack}\n` : ''
    );
  }
  
  /**
   * Get all detected violations (for debugging)
   */
  static getViolations(): string[] {
    return Array.from(this.violations);
  }
}
```

**Step 8.2:** Add Supabase access monitoring

Create `src/integrations/supabase/monitored-client.ts`:
```typescript
/**
 * Monitored Supabase Client
 * 
 * Wraps the Supabase client to detect architectural violations
 * in development mode.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { ArchitectureEnforcement } from '@/utils/architectureEnforcement';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const baseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

// In development, wrap the client to monitor access
export const supabase = process.env.NODE_ENV === 'development' 
  ? createMonitoredClient(baseClient)
  : baseClient;

function createMonitoredClient(client: typeof baseClient) {
  const handler = {
    get(target: any, prop: string) {
      if (prop === 'from') {
        return (table: string) => {
          // Check if call is from components/
          const stack = new Error().stack || '';
          const isFromComponent = stack.includes('/components/') && 
                                  !stack.includes('/orchestrators/');
          
          if (isFromComponent) {
            ArchitectureEnforcement.logViolation('direct_db_access', {
              location: extractLocation(stack),
              description: `Direct Supabase access to '${table}' from UI component`,
              stack
            });
          }
          
          return target.from(table);
        };
      }
      
      return target[prop];
    }
  };
  
  return new Proxy(client, handler);
}

function extractLocation(stack: string): string {
  const lines = stack.split('\n');
  const componentLine = lines.find(line => line.includes('/components/'));
  if (componentLine) {
    const match = componentLine.match(/\/components\/[^:]+/);
    return match ? match[0] : 'unknown';
  }
  return 'unknown';
}
```

**Step 8.3:** Initialize enforcement in main.tsx
```typescript
// src/main.tsx
import { ArchitectureEnforcement } from './utils/architectureEnforcement';

if (import.meta.env.DEV) {
  ArchitectureEnforcement.initialize();
}

// ... rest of main.tsx
```

**Step 8.4:** Add export controls

Update `src/services/index.ts`:
```typescript
/**
 * 🏗️ AI-Optimized Services Architecture - Central Index
 * SINGLE SOURCE OF TRUTH for all service imports
 * 
 * 🚨 ARCHITECTURAL RULES:
 * ✅ Components import from @/services (orchestrators only)
 * ❌ Components DO NOT import from @/domain/rules directly
 * ❌ Components DO NOT import from @/services/data directly
 */

// 🎯 ORCHESTRATORS - The ONLY exports UI should use
export { ProjectOrchestrator } from './orchestrators/ProjectOrchestrator';
export { PhaseOrchestrator } from './orchestrators/PhaseOrchestrator';
export { CalendarEventOrchestrator } from './orchestrators/CalendarEventOrchestrator';
export { ClientOrchestrator } from './orchestrators/ClientOrchestrator';
export { FeedbackOrchestrator } from './orchestrators/FeedbackOrchestrator'; // NEW
// ... other orchestrators

// ❌ DO NOT export domain rules (components should use orchestrators)
// ❌ DO NOT export data mappers (internal to orchestrators)

// Export types for UI consumption
export type { /* ... */ } from './orchestrators/...';
```

**Verification:**
- [ ] ArchitectureEnforcement utility created
- [ ] Monitored Supabase client active in dev
- [ ] Violations logged to console
- [ ] Export controls in place

---

### **Task 14: Documentation Cleanup** (1 hour)

**Step 9.1:** Remove deprecated markers

Update `src/domain/index.ts`:
```typescript
// Remove this commented line:
// export * from './domain-services'; // DEPRECATED - will be deleted

// Add clear documentation instead:
/**
 * Domain Layer - Single Source of Truth for Business Logic
 * 
 * Architecture (Stage 2 - Tightened):
 * - domain/rules/ - ALL business logic (validation + calculations)
 * - domain/entities/ - Rich domain models
 * - domain/value-objects/ - Immutable primitives
 * 
 * Note: domain-services/ was merged into domain/rules/ (Stage 1)
 */
```

Update `src/services/index.ts`:
```typescript
// Remove this:
// ⚠️ TODO: Migrate these to new architecture layers above

// Replace with:
/**
 * Architecture Status: Stage 2 Complete
 * All services follow three-layer pattern:
 * 1. domain/rules/ - Business logic
 * 2. services/orchestrators/ - Workflow coordination
 * 3. services/data/ - Data transformation
 */
```

**Step 9.2:** Update `.ddd` with Stage 2 completion
```markdown
## ✅ ARCHITECTURE STAGE 2 COMPLETE (January 2026)

### Additional Hardening (Post-Stage 1)

**Problem Solved:**
Despite Stage 1's three-layer consolidation, bugs could still hide due to:
- Business logic leaking into orchestrators
- UI components bypassing orchestrators
- Incomplete domain rules (TODOs)

**Stage 2 Solution:**
1. ✅ All orchestrator logic extracted to domain rules
2. ✅ All UI components use orchestrators exclusively
3. ✅ All TODOs completed
4. ✅ Development-time enforcement active
5. ✅ Zero architectural violations

**Result:** Bug location is now UNAMBIGUOUS.
```

**Verification:**
- [ ] No deprecated comments remain
- [ ] Documentation reflects current state
- [ ] `.ddd` updated with Stage 2 status

---

## 📊 VERIFICATION CHECKLIST

After completing all tasks:

### Code Quality Checks
- [ ] No business logic in orchestrators (only delegation)
- [ ] No direct Supabase calls in components (except debug tools)
- [ ] No TODO comments related to architecture
- [ ] All calculations in domain rules
- [ ] All validations in domain rules

### Build & Test Checks
- [ ] `npm run build` succeeds with zero errors
- [ ] All existing tests pass
- [ ] No TypeScript compilation errors
- [ ] No console warnings in development

### Enforcement Checks
- [ ] Architecture enforcement logs violations
- [ ] FeedbackModal violation detected (before fix)
- [ ] No violations after fixes applied
- [ ] Export controls prevent direct imports

### Documentation Checks
- [ ] `.ddd` updated with Stage 2 status
- [ ] No deprecated markers remain
- [ ] README reflects current architecture

---

## 📈 SUCCESS METRICS

**Before Stage 2:**
- Budget logic: 2 locations (orchestrator + rules)
- Recurring event logic: Not using domain rules pattern
- Time tracking calcs: Inline in orchestrator
- Holiday validation: 200+ lines in orchestrator
- Group validation: Inline in orchestrator
- Event validation: Inline in orchestrator
- Project analysis: Mixed orchestrator + rules
- Timeline classification: 50+ lines in orchestrator
- FeedbackModal: Direct DB access
- TODOs: 41 markers
- Enforcement: None

**After Stage 2:**
- Budget logic: 1 location (domain rules only)
- Recurring event logic: Domain rules pattern (`EventRecurrence`)
- Time tracking calcs: Domain rules (`TimeEntryCalculation`)
- Holiday validation: Domain rules (`HolidayValidation`)
- Group validation: Domain rules (`GroupValidation`)
- Event validation: Domain rules (`EventValidation`)
- Project analysis: Domain rules (`ProjectBudget.analyzeProjectPhases`)
- Timeline classification: Domain rules (`TimelineDisplay.classifyDayAllocationType`)
- FeedbackModal: Uses `FeedbackOrchestrator`
- TODOs: Architecture-related removed
- Enforcement: Active in development

**Bug Fixing Clarity:**
- ✅ ONE place to look for business logic (`domain/rules/`)
- ✅ ZERO alternate code paths
- ✅ CLEAR violations flagged automatically
- ✅ IMPOSSIBLE to bypass by accident

---

## 🎯 POST-STAGE-2 STATE

**When you encounter a bug:**

1. **Identify the entity** (Phase, Project, Event, TimeEntry, Feedback)
2. **Go to domain/rules/[entity]/** - Business logic is ALWAYS here
3. **Fix the bug** in domain rules
4. **Orchestrator automatically uses fix** (it delegates)
5. **UI automatically gets fix** (it uses orchestrator)

**No more:**
- ❌ Checking multiple locations
- ❌ Wondering if orchestrator has duplicate logic
- ❌ Finding inline calculations
- ❌ Discovering UI bypasses

**Architecture is now:**
- ✅ Self-enforcing
- ✅ Self-documenting
- ✅ Bug-location-obvious

---

## 📅 EXECUTION TIMELINE

**Suggested approach:** Work through tasks sequentially

| Day | Tasks | Hours |
|-----|-------|-------|
| **Day 1** | Tasks 1-2 (Phase orchestrator extraction) | 6 hours |
| **Day 2** | Tasks 3-5 (Recurring events, time tracking, feedback) | 9 hours |
| **Day 3** | Tasks 6-8 (Holiday, group, event validation) | 8 hours |
| **Day 4** | Tasks 9-11 (Project analysis, timeline, TODOs) | 6 hours |
| **Day 5** | Tasks 12-14 (Imports, enforcement, docs) | 5 hours |

**Total:** 5 days of focused work to achieve bug-fixing clarity.

---

## 🚀 READY TO EXECUTE

This document provides:
- ✅ Clear problem statement
- ✅ Specific code examples
- ✅ Step-by-step solutions
- ✅ Verification checklists
- ✅ Success metrics

**Next step:** Start with Task 1 and work through systematically.

**End goal:** When you see a bug, you know EXACTLY where to look and fix it.
