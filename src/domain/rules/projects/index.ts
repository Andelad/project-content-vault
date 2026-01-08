/**
 * Project Rules Module
 * 
 * Centralized exports for all project-related business rules.
 * 
 * Structure:
 * - ProjectValidation.ts - Core validation, dates, budget analysis (from ProjectRules.ts)
 * - ProjectBudget.ts - Budget calculations and tracking (migrated from domain-services)
 * - ProjectIntegrity.ts - Project referential integrity validation ✅
 * - ProjectDeletionImpact.ts - Project deletion cascade analysis ✅
 */

// Core validation rules
export * from './ProjectValidation';

// Budget service (migrated from domain-services)
export * from './ProjectBudget';

// Integrity validation
export * from './ProjectIntegrity';

// Deletion impact analysis
export * from './ProjectDeletionImpact';
