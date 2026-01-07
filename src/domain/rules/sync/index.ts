/**
 * Synchronization Rules Module
 * 
 * Cross-cutting business rules for synchronizing data across entities.
 * 
 * Structure:
 * - DateSync.ts - Phase/project date synchronization + inline date math
 * - BudgetSync.ts - Phase/project budget synchronization + inline budget math
 * 
 * Purpose:
 * These rules handle bi-directional relationships where changes to one entity
 * may require updates to related entities (e.g., phase dates → project dates)
 */

export * from './DateSync';
export * from './BudgetSync';
