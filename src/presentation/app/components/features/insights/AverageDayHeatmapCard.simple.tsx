import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shadcn/card';
import { Sun } from 'lucide-react';
import { CalendarEvent, Group, Project } from '@/shared/types';
interface AverageDayHeatmapCardProps {
  events: CalendarEvent[];
  groups: Group[];
  projects: Project[];
}
export const AverageDayHeatmapCard: React.FC<AverageDayHeatmapCardProps> = ({
  events,
  groups,
  projects
}) => {
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-orange-500" />
          SIMPLE Average Day Heatmap
        </CardTitle>
        <CardDescription>
          Simple test version to check if component loads
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="p-4">
          <p>Events: {events?.length || 0}</p>
          <p>Groups: {groups?.length || 0}</p>
          <p>Projects: {projects?.length || 0}</p>
          <div className="mt-4 text-sm text-gray-600">
            If you can see this, the component import is working correctly!
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
