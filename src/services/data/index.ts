/**
 * Data Layer Index
 * 
 * Central export point for the data layer.
 * 
 * Architecture:
 * - mappers/ - Transform DB rows ↔ domain DTOs (field name translations, type conversions)
 * - aggregators/ - Fetch and combine data from multiple sources
 * - imports/ - Parse and transform external calendar data
 * 
 * NO business logic here - that belongs in domain/rules/
 */

// Mappers - Data transformation
export * from './mappers';

// Aggregators - Data combination
export * from './aggregators';

// Imports - External calendar parsing
export * from './imports';

// Work Hours - Work hour exceptions and patterns
export * from './workHours';

// Day Estimate Aggregation
export * from './DayEstimateAggregate';
