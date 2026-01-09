import React from 'react';
import { Clock, TrendingUp, Calendar, Target } from 'lucide-react';
import { ProjectProgressGraph } from './ProjectProgressGraph';
import { Project, CalendarEvent, Holiday } from '@/shared/types';
import { formatDuration } from '@/presentation/utils/dateCalculations';;
import { calculateProjectTimeMetrics } from '@/domain/rules/projects/ProjectMetrics';;
import type { ProjectEvent } from '@/domain/rules/projects/ProjectMetrics';

interface ProjectInsightsSectionProps {
  project: Project;
  events: CalendarEvent[];
  holidays: Holiday[];
}

export const ProjectInsightsSection: React.FC<ProjectInsightsSectionProps> = ({
  project,
  events,
  holidays,
}) => {
  // Calculate project metrics using the standard function
  const projectEventsForMetrics = React.useMemo<ProjectEvent[]>(() => {
    return (events || [])
      .filter((event) => event.projectId === project.id)
      .map((event) => ({
        id: event.id,
        startTime: event.startTime,
        endTime: event.endTime,
        completed: event.completed,
        projectId: event.projectId!,
      }));
  }, [events, project.id]);

  const projectEventsForDisplay = React.useMemo(() => {
    return (events || []).filter((event) => event.projectId === project.id);
  }, [events, project.id]);

  const metrics = React.useMemo(() => {
    if (!project || !projectEventsForMetrics || !holidays) return null;
    return calculateProjectTimeMetrics(project, projectEventsForMetrics, holidays, new Date());
  }, [project, projectEventsForMetrics, holidays]);

  if (!metrics) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>No data available for insights</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Progress Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="font-medium">Progress</h3>
          </div>
          <div className="text-2xl font-bold text-primary mb-1">
            {((metrics.completedTime / metrics.totalBudgetedTime) * 100).toFixed(1)}%
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, (metrics.completedTime / metrics.totalBudgetedTime) * 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-card rounded-lg p-4 border">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <h3 className="font-medium">Time Tracking</h3>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Logged:</span>
              <span className="font-medium">{formatDuration(metrics.completedTime)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining:</span>
              <span className="font-medium">{formatDuration(Math.max(0, metrics.totalBudgetedTime - metrics.completedTime))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Project Progress Graph */}
      <div className="bg-card rounded-lg p-4 border">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-green-500" />
          <h3 className="font-medium">Progress Over Time</h3>
        </div>
        <ProjectProgressGraph
          project={project}
          events={projectEventsForDisplay}
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg p-4 border text-center">
          <div className="text-lg font-bold text-foreground mb-1">
            {projectEventsForDisplay.length}
          </div>
          <div className="text-sm text-muted-foreground">Time Entries</div>
        </div>

        <div className="bg-card rounded-lg p-4 border text-center">
          <div className="text-lg font-bold text-foreground mb-1">
            {formatDuration(metrics.totalBudgetedTime)}
          </div>
          <div className="text-sm text-muted-foreground">Estimated</div>
        </div>

        <div className="bg-card rounded-lg p-4 border text-center">
          <div className="text-lg font-bold text-foreground mb-1">
            {((metrics.completedTime / metrics.totalBudgetedTime) * 100) > 100 ? 'Over Budget' : 'On Track'}
          </div>
          <div className="text-sm text-muted-foreground">Status</div>
        </div>
      </div>
    </div>
  );
};
