/**
 * Timeline Orchestrator
 * Single source of truth for timeline data preparation
 * 
 * ONE method that BOTH Days and Weeks views call
 * 
 * @module TimelineOrchestrator
 */

import { Project, CalendarEvent, Settings, Holiday, DayEstimate, Milestone } from '@/types/core';
import { milestoneRepository } from '../repositories/MilestoneRepository';
import { UnifiedDayEstimateService } from '../unified/UnifiedDayEstimateService';

export interface TimelineProjectData {
  project: Project;
  milestones: Milestone[];
  dayEstimates: DayEstimate[];
}

export interface TimelineData {
  projectData: TimelineProjectData[];
}

/**
 * Timeline Orchestrator
 * Prepares complete timeline data for rendering
 */
export class TimelineOrchestrator {
  /**
   * Get complete timeline data for rendering
   * SINGLE SOURCE OF TRUTH for timeline display
   */
  static async getTimelineData(
    projects: Project[],
    dateRange: { start: Date; end: Date },
    events: CalendarEvent[],
    settings: Settings,
    holidays: Holiday[]
  ): Promise<TimelineData> {
    const projectData = await Promise.all(
      projects.map(async (project) => {
        // Get milestones from repository
        const milestones = await milestoneRepository.findByProjectId(project.id);
        
        // Calculate day estimates (single source of truth)
        const dayEstimates = UnifiedDayEstimateService.getDayEstimatesForRange(
          project,
          milestones,
          dateRange.start,
          dateRange.end,
          events,
          settings,
          holidays
        );
        
        return {
          project,
          milestones,
          dayEstimates
        };
      })
    );
    
    return { projectData };
  }
}
