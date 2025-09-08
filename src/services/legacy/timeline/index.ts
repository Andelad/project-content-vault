// Legacy Timeline Services
export * from './TimelineBusinessLogicService';
export * from './TimelineCalculationService';
export * from './TimelinePositioningService';

// Explicit re-exports to resolve naming conflicts
export type { TimelinePosition, ViewportConfig } from './TimelineCalculationService';
