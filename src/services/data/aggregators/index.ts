/**
 * Data Aggregators Index
 * 
 * Central export point for all data aggregators.
 * Aggregators fetch and combine data from multiple sources.
 */

export { ProjectAggregate } from './ProjectAggregate';
export type { ProjectWithRelations } from './ProjectAggregate';

export { TimelineAggregator, timelineAggregator, getTimelineBarData } from './TimelineAggregator';
export type { TimelineProjectData } from './TimelineAggregator';
