/**
 * Type definitions - single source of truth for all domain types.
 * 
 * @see {@link /docs/core/App Logic.md} - Entity definitions and business logic
 * @see {@link /docs/operations/TYPE_ALIGNMENT_ANALYSIS.md} - Type alignment status
 */

// Re-export all types from core.ts - single source of truth
export * from './core';

// Preferred terminology exports (use these in new code)
export type { Phase } from './core'; // ✅ Use this instead of Milestone

// Legacy re-exports for compatibility
export type { ViewType } from './core';