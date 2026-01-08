/**
 * Client Rules Module
 * 
 * Centralized exports for all client-related business rules.
 * 
 * Structure:
 * - ClientValidation.ts - Client validation logic (from ClientRules.ts)
 * - LabelValidation.ts - Label validation logic (from LabelRules.ts)
 * - ClientDeletionImpact.ts - Client deletion cascade analysis ✅
 */

export * from './ClientValidation';
export * from './LabelValidation';
export * from './ClientDeletionImpact';
