import React from 'react';
import { MilestoneManager } from './MilestoneManager';

interface ProjectMilestoneSectionProps {
  projectId: string;
  project: any;
}

export const ProjectMilestoneSection: React.FC<ProjectMilestoneSectionProps> = ({
  projectId,
  project,
}) => {
  return (
    <div className="p-6 h-full">
      <div className="mb-4">
        <h3 className="text-lg font-medium">Project Milestones</h3>
        <p className="text-sm text-muted-foreground">
          Manage milestones and track progress for {project?.name}
        </p>
      </div>

      <MilestoneManager
        projectId={projectId}
        projectEstimatedHours={project?.estimatedHours || 0}
        projectStartDate={project?.startDate || new Date()}
        projectEndDate={project?.endDate || new Date()}
        projectContinuous={project?.continuous || false}
      />
    </div>
  );
};
