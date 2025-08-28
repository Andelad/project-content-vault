import React from 'react';
import { X, Calendar, Clock, User } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { formatDate } from '../../utils/dateFormatUtils';
import { formatTimeHoursMinutes } from '../../utils/timeFormatUtils';
import { calculateProjectStatus, formatProjectDateRange } from '../../services/projects/projectStatusService';

interface ProjectHeaderProps {
  project: any;
  onClose: () => void;
}

export const ProjectModalHeader: React.FC<ProjectHeaderProps> = ({
  project,
  onClose,
}) => {
  const projectStatus = React.useMemo(() => {
    return calculateProjectStatus(project);
  }, [project]);

  const formatProjectDates = () => {
    if (!project.startDate || !project.endDate) return null;

    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="w-4 h-4" />
        <span>{formatProjectDateRange(project)}</span>
        {projectStatus.isOverdue && (
          <Badge variant="destructive" className="text-xs">
            Overdue
          </Badge>
        )}
        {projectStatus.isActive && !projectStatus.isOverdue && (
          <Badge variant="secondary" className="text-xs">
            Active
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="flex items-start justify-between p-6 border-b border-border">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-medium"
            style={{ backgroundColor: project.color || '#6366f1' }}
          >
            {project.icon || '📁'}
          </div>
          <h1 className="text-xl font-semibold text-foreground truncate">
            {project.name}
          </h1>
        </div>

        {project.client && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <User className="w-4 h-4" />
            <span>{project.client}</span>
          </div>
        )}

        {formatProjectDates()}

        {project.estimatedHours && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
            <Clock className="w-4 h-4" />
            <span>{formatTimeHoursMinutes(project.estimatedHours)} estimated</span>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="ml-4"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
};
