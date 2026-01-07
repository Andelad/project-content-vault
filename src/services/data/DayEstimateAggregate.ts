/**
 * Day Estimate Aggregation Service
 * 
 * Aggregates and summarizes day estimates across projects and dates.
 * Part of the data layer - transforms calculation outputs into UI-friendly formats.
 */

import type { Project, PhaseDTO, CalendarEvent, Settings, Holiday, DayEstimate } from '@/types/core';
import { getDateKey } from '@/utils/dateFormatUtils';
import { 
  calculateProjectDayEstimates,
  isWorkingDayForEstimates as isWorkingDay
} from '@/domain/rules/projects/DayEstimate';

/**
 * Project summary for a specific date
 */
export interface DailyProjectSummary {
  projectId: string;
  projectName: string;
  client: string | null;
  estimatedHours: number;
  color?: string;
}

/**
 * Get daily project summaries for multiple dates
 * Aggregates day estimates into a UI-friendly format for calendar display
 */
export function getDailyProjectSummaries(
  dates: Date[],
  projects: Project[],
  phasesMap: Map<string, PhaseDTO[]>,
  events: CalendarEvent[],
  settings: Settings,
  holidays: Holiday[]
): Map<string, DailyProjectSummary[]> {
  const summariesByDate = new Map<string, DailyProjectSummary[]>();
  
  dates.forEach(date => {
    const dateKey = getDateKey(date);
    const projectSummaries: DailyProjectSummary[] = [];
    
    projects.forEach(project => {
      // Fetch and normalize phases for this project to match TimelineBar logic
      const allPhases = phasesMap.get(project.id) || [];
      const projectStart = new Date(project.startDate);
      const projectEnd = new Date(project.endDate);

      // Filter phases within project bounds
      let projectPhases = allPhases.filter((phase: PhaseDTO) => {
        const end = new Date(phase.endDate || phase.dueDate);
        return end >= projectStart && end <= projectEnd;
      });

      // HYBRID SYSTEM: If there's a template phase (isRecurring=true),
      // exclude old numbered instances to prevent double-counting
      const hasTemplatePhase = projectPhases.some((phase: PhaseDTO) => phase.isRecurring === true);
      if (hasTemplatePhase) {
        projectPhases = projectPhases.filter((phase: PhaseDTO) => 
          phase.isRecurring === true || (!phase.isRecurring && (!phase.name || !/\s\d+$/.test(phase.name)))
        );
      }

      // Calculate day estimates for this project (this already excludes days with events)
      const dayEstimates = calculateProjectDayEstimates(
        project,
        projectPhases,
        settings,
        holidays,
        events
      );

      // Get estimates for this specific date
      const estimatesForDate = getDayEstimatesForDate(dayEstimates, date);

      // Only include auto-estimate sources (events are already handled)
      const autoEstimates = estimatesForDate.filter(
        est => est.source === 'milestone-allocation' || est.source === 'project-auto-estimate'
      );

      // Enforce working day rule for auto-estimates: do not show on holidays/non-working days
      const isWorking = isWorkingDay(date, settings, holidays, project);

      if (autoEstimates.length > 0 && isWorking) {
        const totalHours = autoEstimates.reduce((sum, est) => sum + est.hours, 0);
        projectSummaries.push({
          projectId: project.id,
          projectName: project.name,
          client: project.client || null,
          estimatedHours: totalHours,
          color: project.color
        });
      }
    });

    summariesByDate.set(dateKey, projectSummaries);
  });

  return summariesByDate;
}

/**
 * Get day estimates for a specific date
 * Helper function to filter estimates by date
 */
function getDayEstimatesForDate(estimates: DayEstimate[], date: Date): DayEstimate[] {
  const targetKey = getDateKey(date);
  return estimates.filter(est => getDateKey(new Date(est.date)) === targetKey);
}
