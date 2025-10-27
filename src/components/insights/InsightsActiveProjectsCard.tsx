import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Target, Clock, Calendar } from 'lucide-react';
import { Project } from '../../types';

interface InsightsActiveProjectsCardProps {
  showActiveProjects: boolean;
  setShowActiveProjects: (show: boolean) => void;
  currentProjects: Project[];
  futureProjects: Project[];
  today: Date;
}

export const InsightsActiveProjectsCard: React.FC<InsightsActiveProjectsCardProps> = ({
  showActiveProjects,
  setShowActiveProjects,
  currentProjects,
  futureProjects,
  today
}) => {
  return (
    <Card className="lg:col-span-1">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-[#02c0b7]" />
            <CardTitle>
              {showActiveProjects ? 'Active Projects' : 'Future Projects'}
            </CardTitle>
            <Badge variant="secondary">
              {showActiveProjects ? currentProjects.length : futureProjects.length}
            </Badge>
          </div>
          <Select value={showActiveProjects ? 'active' : 'future'} onValueChange={(value) => setShowActiveProjects(value === 'active')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="future">Future</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardDescription>
          {showActiveProjects
            ? 'Projects currently active and their estimated hours'
            : 'Upcoming projects and their estimated hours'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {showActiveProjects ? (
          // Active Projects View
          currentProjects.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No active projects today</p>
              <p className="text-sm">Create a new project to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentProjects.map(project => {
                const progress = Math.round(
                  ((today.getTime() - new Date(project.startDate).getTime()) /
                   (new Date(project.endDate).getTime() - new Date(project.startDate).getTime())) * 100
                );

                return (
                  <div key={project.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <div>
                        <div className="font-medium">{project.name}</div>
                        <div className="text-sm text-gray-500">
                          {project.clientData?.name || project.client || 'No client'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-medium">{project.estimatedHours}h</div>
                        <div className="text-gray-500">Estimated</div>
                      </div>

                      <div className="text-center">
                        <div className="font-medium">{Math.max(0, Math.min(100, progress))}%</div>
                        <div className="text-gray-500">Progress</div>
                      </div>

                      <div className="text-center">
                        <div className="font-medium">
                          {Math.ceil((new Date(project.endDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))}d
                        </div>
                        <div className="text-gray-500">Remaining</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          // Future Projects View
          futureProjects.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No upcoming projects scheduled</p>
              <p className="text-sm">Future projects will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {futureProjects
                .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                .map(project => {
                  const daysUntilStart = Math.ceil((new Date(project.startDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

                  return (
                    <div key={project.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        <div>
                          <div className="font-medium">{project.name}</div>
                          <div className="text-sm text-gray-500">
                            {project.clientData?.name || project.client || 'No client'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-medium">{project.estimatedHours}h</div>
                          <div className="text-gray-500">Estimated</div>
                        </div>

                        <div className="text-center">
                          <div className="font-medium">
                            {new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-gray-500">Start Date</div>
                        </div>

                        <div className="text-center">
                          <div className="font-medium">{daysUntilStart}d</div>
                          <div className="text-gray-500">Until Start</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
};
