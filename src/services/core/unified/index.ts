/**
 * Unified Calculation Services
 * 
 * These services consolidate all calculation logic into a single, authoritative pipeline.
 * They replace the legacy calculation services and provide:
 * 
 * - Consistent working day calculations
 * - Unified milestone processing
 * - Centralized project metrics
 * - Better performance through reduced duplication
 */

export * from './UnifiedWorkingDayService';
export * from './UnifiedMilestoneService';
export * from './UnifiedProjectMetricsService';
