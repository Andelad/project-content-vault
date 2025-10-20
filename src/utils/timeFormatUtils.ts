// ⚠️ DEPRECATED: Time formatting utilities
// 
// ❌ ARCHITECTURAL VIOLATION: Business logic should not be in utils/
// ✅ MIGRATE TO: Import from '@/services' instead
//
// This file will be removed in future versions.
// All time formatting has been consolidated to services/calculations/dateCalculations.ts

// Re-export from the authoritative source for backward compatibility
export { 
  formatDuration as formatTimeHoursMinutes,
  formatDuration,
  formatDurationFromMinutes,
  formatDuration as formatDurationFromHours,
  formatDuration as formatDurationPreview
} from '@/services/calculations/general/dateCalculations';

// ⚠️ DEPRECATED NOTICE:
// These functions are deprecated. Use imports from '@/services' instead:
// 
// ❌ OLD: import { formatTimeHoursMinutes } from '@/utils/timeFormatUtils';
// ✅ NEW: import { formatDuration } from '@/services';
//
