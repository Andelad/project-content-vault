/**
 * Application Layer - Queries/Aggregators Index
 * 
 * Central export point for all data aggregators and queries.
 * Aggregators fetch and combine data from multiple sources.
 */

export { ProjectAggregate } from './ProjectAggregate';
export type { ProjectWithRelations } from './ProjectAggregate';

export { TimelineAggregator, timelineAggregator, getTimelineBarData } from './TimelineAggregator';
export type { TimelineProjectData } from './TimelineAggregator';

export * from './DayEstimateAggregate';
export * from './timeTracking';
export * from './imports';
export * from './workHours';
