/**
 * Project Rules Module
 * 
 * Centralized exports for all project-related business rules.
 * 
 * Structure:
 * - ProjectValidation.ts - Core validation, dates, budget analysis (from ProjectRules.ts)
 * - ProjectBudget.ts - Budget calculations and tracking (migrated from domain-services)
 */

// Core validation rules
export * from './ProjectValidation';

// Budget service (migrated from domain-services)
export * from './ProjectBudget';
