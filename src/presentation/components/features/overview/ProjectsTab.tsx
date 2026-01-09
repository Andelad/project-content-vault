import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/presentation/components/shadcn/card';
import { Badge } from '@/presentation/components/shadcn/badge';
import { Button } from '@/presentation/components/shadcn/button';
import { Calendar, Clock, Trash2, Users, Search, Folder, Building2, Tag } from 'lucide-react';
import { Project, Group } from '@/shared/types';
import { getEffectiveProjectStatus } from '@/domain/rules/projects/ProjectMetrics';
import { DurationFormattingService } from '@/domain/rules/projects/ProjectBudget';;

type FilterByStatus = 'all' | 'active' | 'future' | 'past';
type OrganizeBy = 'group' | 'tag' | 'client';

interface ProjectsTabProps {
  projects: Project[];
  groups: Group[];
  organizeBy: OrganizeBy;
  filterByStatus: FilterByStatus;
  searchQuery: string;
  filterByDate: Date | undefined;
  onProjectClick: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onClearFilters: () => void;
}

export const ProjectsTab = ({
  projects,
  groups,
  organizeBy,
  filterByStatus,
  searchQuery,
  filterByDate,
  onProjectClick,
  onDeleteProject,
  onClearFilters
}: ProjectsTabProps) => {
  // Format date helper
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Filter and organize projects
  const filteredProjects = useMemo(() => {
    let filtered = [...projects];

    // Filter by status
    if (filterByStatus === 'active') {
      filtered = filtered.filter(p => getEffectiveProjectStatus(p) === 'current');
    } else if (filterByStatus === 'future') {
      filtered = filtered.filter(p => getEffectiveProjectStatus(p) === 'future');
    } else if (filterByStatus === 'past') {
      filtered = filtered.filter(p => getEffectiveProjectStatus(p) === 'archived');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.clientData?.name && p.clientData.name.toLowerCase().includes(query)) ||
        (p.client && p.client.toLowerCase().includes(query))
      );
    }

    // Filter by date
    if (filterByDate) {
      const targetDate = new Date(filterByDate);
      targetDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(p => {
        const start = new Date(p.startDate);
        const end = new Date(p.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        return start <= targetDate && targetDate <= end;
      });
    }

    return filtered;
  }, [projects, filterByStatus, searchQuery, filterByDate]);

  // Organize filtered projects
  const organizedProjects = useMemo(() => {
    if (organizeBy === 'group') {
      // Group by group
      const byGroup: { [key: string]: { group: Group; projects: Project[] } } = {};
      groups.forEach(group => {
        byGroup[group.id] = { group, projects: [] };
      });
      filteredProjects.forEach(project => {
        if (byGroup[project.groupId]) {
          byGroup[project.groupId].projects.push(project);
        }
      });
      return Object.values(byGroup).filter(g => g.projects.length > 0);
    } else if (organizeBy === 'client') {
      // Group by client
      const byClient: { [key: string]: Project[] } = {};
      filteredProjects.forEach(project => {
        const clientName = project.clientData?.name || project.client || 'No Client';
        if (!byClient[clientName]) {
          byClient[clientName] = [];
        }
        byClient[clientName].push(project);
      });
      return Object.entries(byClient).map(([clientName, projects]) => ({
        key: clientName,
        label: clientName,
        projects
      }));
    } else {
      // Group by tag (placeholder - would need tag implementation)
      return [{
        key: 'all',
        label: 'All Projects',
        projects: filteredProjects
      }];
    }
  }, [organizeBy, filteredProjects, groups]);

  // Render project in list format
  const renderListProject = (project: Project) => (
    <Card key={project.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onProjectClick(project.id)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {/* Left section - Project info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-gray-900 truncate text-sm">{project.name}</h3>
                <span className="text-xs text-gray-600 whitespace-nowrap">
                  {project.clientData?.name || project.client || 'No client'}
                </span>
              </div>
            </div>
          </div>
          {/* Middle section - Timeline info */}
          <div className="flex items-center gap-4 flex-1 justify-center">
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Calendar className="w-3 h-3" />
              <span className="whitespace-nowrap">
                {formatDate(project.startDate)} - {formatDate(project.endDate)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Clock className="w-3 h-3 text-gray-600" />
              <span className="whitespace-nowrap font-medium text-gray-900">{project.estimatedHours}h</span>
            </div>
            <div className="text-xs text-gray-500">
              <span>{DurationFormattingService.formatDuration(project.startDate, project.endDate)}</span>
            </div>
          </div>
          {/* Right section - Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteProject(project.id);
              }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 h-6 w-6"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const hasFilters = searchQuery || filterByDate || filterByStatus !== 'all';

  return (
    <div className="space-y-8">
      {/* Clear filters button */}
      {hasFilters && filteredProjects.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-7 text-xs"
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* Organized Projects Display */}
      {organizedProjects.length > 0 ? (
        <div className="space-y-6">
          {organizedProjects.map((section, index) => {
            // Handle group organization
            if ('group' in section) {
              const groupData = section as { group: Group; projects: Project[] };
              return (
                <div key={`group-${groupData.group.id}`} className="space-y-3">
                  {/* Group Header */}
                  <div className="flex items-center gap-3">
                    <Folder className="w-4 h-4 text-gray-500" />
                    <h3 className="text-lg font-medium text-gray-900">{groupData.group.name}</h3>
                    <Badge variant="outline" className="text-xs">
                      {groupData.projects.length}
                    </Badge>
                  </div>
                  {/* Projects Display */}
                  <div className="space-y-2">
                    {groupData.projects.map((project) =>
                      renderListProject(project)
                    )}
                  </div>
                </div>
              );
            } else {
              // Handle client or tag organization
              const sectionData = section as { key: string; label: string; projects: Project[] };
              return (
                <div key={`section-${sectionData.key}`} className="space-y-3">
                  {/* Section Header */}
                  <div className="flex items-center gap-3">
                    {organizeBy === 'client' ? (
                      <Building2 className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Tag className="w-4 h-4 text-gray-500" />
                    )}
                    <h3 className="text-lg font-medium text-gray-900">{sectionData.label}</h3>
                    <Badge variant="outline" className="text-xs">
                      {sectionData.projects.length}
                    </Badge>
                  </div>
                  {/* Projects Display */}
                  <div className="space-y-2">
                    {section.projects.map((project) =>
                      renderListProject(project)
                    )}
                  </div>
                </div>
              );
            }
          })}
        </div>
      ) : (
        /* No results message */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-gray-400 mb-4">
              {hasFilters ? (
                <Search className="w-16 h-16" />
              ) : (
                <Users className="w-16 h-16" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {hasFilters
                ? 'No projects found'
                : 'No projects yet'
              }
            </h3>
            <p className="text-gray-600 text-center mb-6 max-w-md">
              {hasFilters
                ? 'Try adjusting your filters or search query'
                : 'Start by going to the Timeline view to create your first group and projects.'
              }
            </p>
            {hasFilters && (
              <Button
                variant="outline"
                onClick={onClearFilters}
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
