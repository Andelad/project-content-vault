# Date and Time Calculation Guidelines

> **SINGLE SOURCE OF TRUTH** for all date and time operations in the application.

## 🎯 Core Principles

### 1. **Centralized Functions Only**
All date/time operations MUST use functions from these files:
- `/src/services/calculations/dateCalculations.ts` - Core date math
- `/src/services/calculations/timeCalculations.ts` - Time operations  
- `/src/services/calculations/eventCalculations.ts` - Event-specific calculations
- `/src/services/unified/UnifiedEventWorkHourService.ts` - Work hour integration

### 2. **No Duplicate Implementations**
❌ **NEVER create these patterns:**
```typescript
// DON'T create custom duration calculations
const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

// DON'T create custom date normalization
const normalized = new Date(someDate);
normalized.setHours(0, 0, 0, 0);

// DON'T create custom overlap detection
const overlap = Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
```

✅ **ALWAYS use centralized functions:**
```typescript
import { 
  calculateDurationHours,
  normalizeToMidnight,
  calculateTimeOverlapHours 
} from '@/services';

const hours = calculateDurationHours(startTime, endTime);
const normalized = normalizeToMidnight(someDate);
const overlap = calculateTimeOverlapHours(startA, endA, startB, endB);
```

## 📋 Function Reference Guide

### **Duration Calculations**
```typescript
// THE authoritative duration calculations
calculateDurationHours(startTime: Date, endTime: Date): number
calculateDurationMinutes(startTime: Date, endTime: Date): number
calculateDurationDays(startDate: Date, endDate: Date): number
```

### **Date Normalization**
```typescript
// THE authoritative date normalization
normalizeToMidnight(date: Date): Date        // Sets to 00:00:00.000
normalizeToEndOfDay(date: Date): Date        // Sets to 23:59:59.999
isSameDay(date1: Date, date2: Date): boolean // Compares dates ignoring time
```

### **Time Overlap Detection**
```typescript
// THE authoritative overlap calculations
calculateTimeOverlapHours(startA: Date, endA: Date, startB: Date, endB: Date): number
calculateTimeOverlapMinutes(startA: Date, endA: Date, startB: Date, endB: Date): number
datesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean
```

### **Cross-Midnight Event Handling**
```typescript
// THE authoritative cross-midnight calculation
calculateEventDurationOnDate(params: {
  event: { startTime: Date; endTime?: Date; completed?: boolean },
  targetDate: Date,
  currentTime?: Date
}): number
```

### **Work Hour Integration**
```typescript
// THE authoritative work hour functions
generateWorkHoursForDate(date: Date, settings: any): WorkHour[]
calculateProjectWorkingDays(projectStart: Date, projectEnd: Date, settings: any, holidays: any[]): ProjectWorkingDaysResult
calculateOvertimePlannedHours(date: Date, events: CalendarEvent[], workHours: WorkHour[]): number
```

### **Time Formatting**
```typescript
// THE authoritative time formatting
formatTime(date: Date, use12Hour?: boolean): string
formatDuration(hours: number): string
formatDurationFromMinutes(minutes: number): string
```

### **Timezone Utilities**
```typescript
// THE authoritative timezone functions
getCurrentTimezone(): string
convertToTimezone(date: Date, timezone: string): Date
getTimezoneOffset(date: Date, timezone?: string): number
isDaylightSavingTime(date: Date, timezone?: string): boolean
```

### **Date Validation**
```typescript
// THE authoritative validation functions
isValidDate(date: any): date is Date
isBusinessDay(date: Date, holidays?: Date[]): boolean
isBusinessHour(date: Date, startHour?: number, endHour?: number): boolean
isWorkingDay(date: Date, settings: any, holidays?: Date[]): boolean
```

## 🚫 Migration Rules

### **Phase 1: Replace Manual Calculations**
When you see patterns like these, replace them:

❌ **Replace this:**
```typescript
const normalized = new Date(someDate);
normalized.setHours(0, 0, 0, 0);
```

✅ **With this:**
```typescript
import { normalizeToMidnight } from '@/services';
const normalized = normalizeToMidnight(someDate);
```

❌ **Replace this:**
```typescript
const durationMs = endTime.getTime() - startTime.getTime();
const hours = durationMs / (1000 * 60 * 60);
```

✅ **With this:**
```typescript
import { calculateDurationHours } from '@/services';
const hours = calculateDurationHours(startTime, endTime);
```

### **Phase 2: Consolidate Duplicates**
Status: **✅ COMPLETED**
- ✅ `generateWorkHoursForDate` - Consolidated to unified service
- ✅ `calculateProjectWorkingDays` - Consolidated to unified service  
- ✅ `calculateOvertimePlannedHours` - Consolidated to unified service
- ✅ `normalizeToMidnight` - Centralized in dateCalculations.ts

## 🎯 Development Workflow

### **Before Adding Date/Time Features:**

1. **Check existing functions first:**
   ```bash
   # Search for existing functionality
   grep -r "calculateDuration\|formatTime\|normalize" src/services/calculations/
   ```

2. **Import from centralized locations:**
   ```typescript
   import { 
     // Duration calculations
     calculateDurationHours, calculateDurationMinutes,
     // Date normalization  
     normalizeToMidnight, normalizeToEndOfDay, isSameDay,
     // Overlap detection
     calculateTimeOverlapHours, calculateTimeOverlapMinutes,
     // Cross-midnight events
     calculateEventDurationOnDate,
     // Work hours
     generateWorkHoursForDate, calculateProjectWorkingDays,
     // Timezone utilities
     getCurrentTimezone, convertToTimezone, getTimezoneOffset,
     // Validation functions
     isValidDate, isBusinessDay, isBusinessHour, isWorkingDay
   } from '@/services';
   ```

3. **Follow naming conventions:**
   - All functions documented as "THE authoritative X calculation used everywhere"
   - Use descriptive names like `calculateEventDurationOnDate` instead of generic `getDuration`
   - Include parameter validation and error handling

### **When Adding New Date/Time Functions:**

1. **Add to appropriate calculation service:**
   - Core math → `dateCalculations.ts`
   - Time-specific → `timeCalculations.ts` 
   - Event-specific → `eventCalculations.ts`
   - Work hours → `UnifiedEventWorkHourService.ts`

2. **Document as single source of truth:**
   ```typescript
   /**
    * Calculate X for Y
    * THE authoritative X calculation used everywhere
    */
   export function calculateSomething(params): ReturnType {
     // Implementation
   }
   ```

3. **Export from main index:**
   ```typescript
   // Add to src/services/index.ts
   export { calculateSomething } from './calculations/dateCalculations';
   ```

## 🔒 Quality Assurance

### **Required Patterns:**
- ✅ All duration calculations use centralized functions
- ✅ All date normalization uses `normalizeToMidnight`/`normalizeToEndOfDay` 
- ✅ All overlap detection uses `calculateTimeOverlap*` functions
- ✅ All cross-midnight events use `calculateEventDurationOnDate`
- ✅ All work hour generation uses `generateWorkHoursForDate`

### **Forbidden Patterns:**
- ❌ Manual time math: `(end - start) / 1000 / 60 / 60`
- ❌ Manual normalization: `date.setHours(0, 0, 0, 0)`
- ❌ Duplicate implementations across services
- ❌ Custom overlap calculations
- ❌ Hard-coded time constants outside of constants files

### **Testing Requirements:**
- All date/time functions must handle edge cases:
  - Cross-midnight events
  - Daylight saving time transitions  
  - Leap years and month boundaries
  - Invalid dates and null inputs

## 🚀 Future Enhancements

### **Planned Improvements:**
1. **✅ Time Zone Support** - COMPLETED: Centralized timezone handling utilities
2. **Performance Optimization** - Memoization for expensive date calculations  
3. **Date Library Migration** - Consider standardizing on date-fns throughout
4. **✅ Validation Utilities** - COMPLETED: Comprehensive date validation functions

### **Architecture Goals:**
- Zero duplicate date/time calculations
- Consistent behavior across all views and components
- Easy testing and maintenance
- Clear single source of truth for all temporal operations

---

**This document ensures all date and time operations follow established patterns and maintain consistency across the entire application.**
