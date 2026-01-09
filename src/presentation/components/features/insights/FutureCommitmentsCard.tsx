import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/presentation/components/shadcn/card';
import { Button } from '@/presentation/components/shadcn/button';
import { GraduationCap } from 'lucide-react';
import type { Project } from '@/shared/types/core';
import { calculateFutureCommitments } from '@/domain/rules/insights/AnalyticsCalculations';;

interface FutureCommitmentsCardProps {
  projects: Project[];
  onHelpClick?: () => void;
}

export const FutureCommitmentsCard: React.FC<FutureCommitmentsCardProps> = ({
  projects,
  onHelpClick
}) => {
  const today = useMemo(() => new Date(), []);

  // Future committed hours using service
  const futureCommitments = useMemo(() => {
    return calculateFutureCommitments(projects, today);
  }, [projects, today]);

  // Future projects
  const futureProjects = useMemo(() => {
    return projects.filter(project => new Date(project.startDate) > today);
  }, [projects, today]);

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle className="text-base">Future Commitments</CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="space-y-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-foreground mb-2">{futureCommitments}h</div>
            <div className="text-sm text-gray-600">Total Estimated Hours</div>
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Upcoming Projects</span>
              <span className="font-medium">{futureProjects.length}</span>
            </div>
            
            {futureProjects.length > 0 && (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Next Project Starts</span>
                  <span className="font-medium">
                    {Math.ceil((new Date(futureProjects.sort((a, b) => 
                      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
                    )[0].startDate).getTime() - today.getTime()) / (24 * 60 * 60 * 1000))}d
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Average Project Size</span>
                  <span className="font-medium">{Math.round(futureCommitments / futureProjects.length)}h</span>
                </div>
              </>
            )}
          </div>
          
          {futureProjects.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              <p className="text-sm">No future commitments</p>
            </div>
          )}
        </div>
      </CardContent>

      {/* Info button bottom-right of the card */}
      {onHelpClick && (
        <div className="absolute bottom-6 right-6">
          <Button
            variant="outline"
            size="icon"
            aria-label="About Future Commitments"
            className="h-9 w-9 rounded-full"
            onClick={onHelpClick}
          >
            <GraduationCap className="w-4 h-4" />
          </Button>
        </div>
      )}
    </Card>
  );
};
