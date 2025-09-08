// Legacy Timeline Services
export * from './TimelineBusinessLogicService';
// TimelineCalculationService migrated to calculations/timelineCalculations.ts
// TimelinePositioningService migrated to ui/TimelinePositioning.ts

// Explicit re-exports to resolve naming conflicts - need to update from calculations/timelineCalculations.ts
export type { TimelinePosition, ViewportConfig } from '../../calculations/timelineCalculations';
