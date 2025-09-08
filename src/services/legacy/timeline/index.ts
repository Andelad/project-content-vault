// Legacy Timeline Services
export * from './TimeAllocationService';
export * from './TimelineBusinessLogicService';
export * from './TimelineCalculationService';
export * from './TimelinePositioningService';
export * from './timelinePositionService';
export * from './timelineViewportService';

// Explicit re-exports to resolve naming conflicts
export type { TimelinePosition, ViewportConfig } from './TimelineCalculationService';
export type { HolidayPositionCalculation, MouseToIndexConversion, ScrollAnimationConfig, ScrollbarCalculation, TimelinePositionCalculation } from './timelinePositionService';
