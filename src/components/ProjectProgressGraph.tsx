import React, { useMemo } from 'react';
import { Project, CalendarEvent, Milestone } from '@/types/core';
import { ProjectTimeMetrics } from '@/lib/projectCalculations';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface ProjectProgressGraphProps {
  project: Project;
  metrics: ProjectTimeMetrics;
  events: CalendarEvent[];
  milestones?: Milestone[];
}

interface DataPoint {
  date: Date;
  estimatedProgress: number;
  completedTime: number;
  plannedTime: number;
}

export function ProjectProgressGraph({ project, metrics, events, milestones = [] }: ProjectProgressGraphProps) {
  const graphData = useMemo(() => {
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (totalDays <= 0) return [];
    
    const data: DataPoint[] = [];
    const projectEvents = events.filter(event => event.projectId === project.id);
    
    // Calculate total planned time by end of project
    const totalPlannedTime = projectEvents.reduce((total, event) => {
      const durationMs = event.endTime.getTime() - event.startTime.getTime();
      return total + (durationMs / (1000 * 60 * 60));
    }, 0);
    
    if (milestones.length > 0) {
      // Milestone-based progress calculation
      const relevantMilestones = milestones
        .filter(m => {
          const milestoneDate = new Date(m.dueDate);
          return milestoneDate >= startDate && milestoneDate <= endDate;
        })
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      
      let cumulativeEstimatedHours = 0;
      let currentDate = new Date(startDate);
      
            // Add starting point
      const completedTimeAtStart = projectEvents
        .filter(event => {
          const eventDate = new Date(event.startTime);
          eventDate.setHours(0, 0, 0, 0);
          const targetDate = new Date(startDate);
          targetDate.setHours(0, 0, 0, 0);
          return event.completed && eventDate <= targetDate;
        })
        .reduce((total, event) => {
          const durationMs = event.endTime.getTime() - event.startTime.getTime();
          return total + (durationMs / (1000 * 60 * 60));
        }, 0);
      
      // Calculate planned time only for events that occur exactly on start date
      const plannedTimeAtStart = projectEvents
        .filter(event => {
          const eventDate = new Date(event.startTime);
          eventDate.setHours(0, 0, 0, 0);
          const targetDate = new Date(startDate);
          targetDate.setHours(0, 0, 0, 0);
          return eventDate.getTime() === targetDate.getTime();
        })
        .reduce((total, event) => {
          const durationMs = event.endTime.getTime() - event.startTime.getTime();
          return total + (durationMs / (1000 * 60 * 60));
        }, 0);
      
      data.push({
        date: new Date(startDate),
        estimatedProgress: 0,
        completedTime: completedTimeAtStart,
        plannedTime: plannedTimeAtStart
      });
      
      // Track cumulative planned time as we go through milestones
      let cumulativePlannedTime = plannedTimeAtStart;
      
      // Add milestone points
      relevantMilestones.forEach((milestone) => {
        const milestoneDate = new Date(milestone.dueDate);
        cumulativeEstimatedHours += milestone.timeAllocation;
        
        // Calculate completed time up to milestone date
        const completedTimeAtMilestone = projectEvents
          .filter(event => {
            const eventDate = new Date(event.startTime);
            eventDate.setHours(0, 0, 0, 0);
            const targetDate = new Date(milestoneDate);
            targetDate.setHours(0, 0, 0, 0);
            return event.completed && eventDate <= targetDate;
          })
          .reduce((total, event) => {
            const durationMs = event.endTime.getTime() - event.startTime.getTime();
            return total + (durationMs / (1000 * 60 * 60));
          }, 0);
        
        // Calculate planned time up to milestone date
        const plannedTimeAtMilestone = projectEvents
          .filter(event => {
            const eventDate = new Date(event.startTime);
            eventDate.setHours(0, 0, 0, 0);
            const targetDate = new Date(milestoneDate);
            targetDate.setHours(0, 0, 0, 0);
            return eventDate <= targetDate;
          })
          .reduce((total, event) => {
            const durationMs = event.endTime.getTime() - event.startTime.getTime();
            return total + (durationMs / (1000 * 60 * 60));
          }, 0);
        
        data.push({
          date: new Date(milestoneDate),
          estimatedProgress: cumulativeEstimatedHours,
          completedTime: completedTimeAtMilestone,
          plannedTime: plannedTimeAtMilestone
        });
      });
      
      // Add milestone points
      relevantMilestones.forEach((milestone) => {
        const milestoneDate = new Date(milestone.dueDate);
        cumulativeEstimatedHours += milestone.timeAllocation;
        
        // Calculate completed time up to milestone date
        const completedTimeAtMilestone = projectEvents
          .filter(event => {
            const eventDate = new Date(event.startTime);
            eventDate.setHours(0, 0, 0, 0);
            const targetDate = new Date(milestoneDate);
            targetDate.setHours(0, 0, 0, 0);
            return event.completed && eventDate <= targetDate;
          })
          .reduce((total, event) => {
            const durationMs = event.endTime.getTime() - event.startTime.getTime();
            return total + (durationMs / (1000 * 60 * 60));
          }, 0);
        
        // Calculate planned time up to milestone date
        const plannedTimeAtMilestone = projectEvents
          .filter(event => {
            const eventDate = new Date(event.startTime);
            eventDate.setHours(0, 0, 0, 0);
            const targetDate = new Date(milestoneDate);
            targetDate.setHours(0, 0, 0, 0);
            return eventDate <= targetDate;
          })
          .reduce((total, event) => {
            const durationMs = event.endTime.getTime() - event.startTime.getTime();
            return total + (durationMs / (1000 * 60 * 60));
          }, 0);
        
        data.push({
          date: new Date(milestoneDate),
          estimatedProgress: cumulativeEstimatedHours,
          completedTime: completedTimeAtMilestone,
          plannedTime: plannedTimeAtMilestone
        });
      });
      
      // Add end point if last milestone doesn't reach the end
      const lastMilestone = relevantMilestones[relevantMilestones.length - 1];
      if (!lastMilestone || new Date(lastMilestone.dueDate) < endDate) {
        const remainingHours = project.estimatedHours - cumulativeEstimatedHours;
        
        const completedTimeAtEnd = projectEvents
          .filter(event => {
            const eventDate = new Date(event.startTime);
            eventDate.setHours(0, 0, 0, 0);
            const targetDate = new Date(endDate);
            targetDate.setHours(0, 0, 0, 0);
            return event.completed && eventDate <= targetDate;
          })
          .reduce((total, event) => {
            const durationMs = event.endTime.getTime() - event.startTime.getTime();
            return total + (durationMs / (1000 * 60 * 60));
          }, 0);
        
        const plannedTimeAtEnd = projectEvents
          .filter(event => {
            const eventDate = new Date(event.startTime);
            eventDate.setHours(0, 0, 0, 0);
            const targetDate = new Date(endDate);
            targetDate.setHours(0, 0, 0, 0);
            return eventDate <= targetDate;
          })
          .reduce((total, event) => {
            const durationMs = event.endTime.getTime() - event.startTime.getTime();
            return total + (durationMs / (1000 * 60 * 60));
          }, 0);
        
        data.push({
          date: new Date(endDate),
          estimatedProgress: project.estimatedHours,
          completedTime: completedTimeAtEnd,
          plannedTime: plannedTimeAtEnd
        });
      }
    } else {
      // Linear progression fallback
      const dailyEstimatedRate = project.estimatedHours / Math.max(1, totalDays);
      
      // Generate data points for key dates in the project range
      const samplePoints = Math.min(20, totalDays);
      for (let i = 0; i <= samplePoints; i++) {
        const dayIndex = Math.floor((i / samplePoints) * totalDays);
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + dayIndex);
        
        // Linear estimated progress based on project timeline
        const estimatedProgress = Math.min(project.estimatedHours, dailyEstimatedRate * dayIndex);
        
        // Calculate completed time up to this date
        const completedTime = projectEvents
          .filter(event => {
            const eventDate = new Date(event.startTime);
            eventDate.setHours(0, 0, 0, 0);
            const targetDate = new Date(currentDate);
            targetDate.setHours(0, 0, 0, 0);
            return event.completed && eventDate <= targetDate;
          })
          .reduce((total, event) => {
            const durationMs = event.endTime.getTime() - event.startTime.getTime();
            return total + (durationMs / (1000 * 60 * 60));
          }, 0);
        
        // Calculate planned time up to this date
        const plannedTime = projectEvents
          .filter(event => {
            const eventDate = new Date(event.startTime);
            eventDate.setHours(0, 0, 0, 0);
            const targetDate = new Date(currentDate);
            targetDate.setHours(0, 0, 0, 0);
            return eventDate <= targetDate;
          })
          .reduce((total, event) => {
            const durationMs = event.endTime.getTime() - event.startTime.getTime();
            return total + (durationMs / (1000 * 60 * 60));
          }, 0);
        
        data.push({
          date: currentDate,
          estimatedProgress,
          completedTime,
          plannedTime
        });
      }
    }
    
    return data;
  }, [project, events, milestones]);

  const maxHours = Math.max(
    project.estimatedHours, 
    metrics.completedTime, 
    Math.max(...graphData.map(d => d.plannedTime), 0),
    1
  );
  const svgWidth = 800;
  const svgHeight = 240;
  const padding = { top: 20, right: 60, bottom: 60, left: 80 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  // Generate Y-axis ticks
  const yTicks = [];
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    const value = (maxHours / tickCount) * i;
    const y = padding.top + chartHeight - (value / maxHours) * chartHeight;
    yTicks.push({ value, y });
  }

  // Generate date labels
  const dateLabels = [];
  const labelCount = Math.min(6, graphData.length);
  for (let i = 0; i < labelCount; i++) {
    const index = Math.floor((i / Math.max(1, labelCount - 1)) * Math.max(0, graphData.length - 1));
    const point = graphData[index];
    if (point) {
      const x = padding.left + (index / Math.max(1, graphData.length - 1)) * chartWidth;
      dateLabels.push({
        date: point.date,
        x,
        label: point.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }
  }

  return (
    <TooltipProvider>
      <div className="border-b border-gray-200 bg-white px-8 py-6 flex-shrink-0">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Project Progress</h3>
        
        {graphData.length > 1 ? (
          <div className="relative w-full">
            <svg
              width="100%"
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full"
              style={{ maxHeight: '240px', minWidth: '600px' }}
            >
            {/* Background */}
            <rect 
              x={padding.left} 
              y={padding.top} 
              width={chartWidth} 
              height={chartHeight} 
              fill="#fafafa" 
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            
            {/* Grid lines */}
            {yTicks.map((tick, index) => (
              <line 
                key={`grid-y-${index}`}
                x1={padding.left} 
                y1={tick.y} 
                x2={padding.left + chartWidth} 
                y2={tick.y} 
                stroke="#f3f4f6" 
                strokeWidth="1"
              />
            ))}
            
            {/* Axes */}
            <line 
              x1={padding.left} 
              y1={padding.top} 
              x2={padding.left} 
              y2={padding.top + chartHeight} 
              stroke="#374151" 
              strokeWidth="2"
            />
            <line 
              x1={padding.left} 
              y1={padding.top + chartHeight} 
              x2={padding.left + chartWidth} 
              y2={padding.top + chartHeight} 
              stroke="#374151" 
              strokeWidth="2"
            />
            
            {/* Y-axis labels */}
            {yTicks.map((tick, index) => (
              <g key={`y-tick-${index}`}>
                <line 
                  x1={padding.left - 5} 
                  y1={tick.y} 
                  x2={padding.left} 
                  y2={tick.y} 
                  stroke="#374151" 
                  strokeWidth="1"
                />
                <text 
                  x={padding.left - 10} 
                  y={tick.y + 4} 
                  textAnchor="end" 
                  fill="#6b7280"
                  fontSize="12"
                  fontFamily="system-ui, sans-serif"
                >
                  {Math.round(tick.value)}h
                </text>
              </g>
            ))}
            
            {/* X-axis labels */}
            {dateLabels.map((label, index) => (
              <g key={`x-label-${index}`}>
                <line 
                  x1={label.x} 
                  y1={padding.top + chartHeight} 
                  x2={label.x} 
                  y2={padding.top + chartHeight + 5} 
                  stroke="#374151" 
                  strokeWidth="1"
                />
                <text 
                  x={label.x} 
                  y={padding.top + chartHeight + 20} 
                  textAnchor="middle" 
                  fill="#6b7280"
                  fontSize="12"
                  fontFamily="system-ui, sans-serif"
                >
                  {label.label}
                </text>
              </g>
            ))}
            
            {/* Data lines */}
            {graphData.length > 1 && (
              <>
                {/* Estimated progress line */}
                <polyline
                  points={graphData.map((point, index) => {
                    const x = padding.left + (index / Math.max(1, graphData.length - 1)) * chartWidth;
                    const y = padding.top + chartHeight - (point.estimatedProgress / maxHours) * chartHeight;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  opacity="0.8"
                />
                
                {/* Planned progress line */}
                <polyline
                  points={graphData.map((point, index) => {
                    const x = padding.left + (index / Math.max(1, graphData.length - 1)) * chartWidth;
                    const y = padding.top + chartHeight - (point.plannedTime / maxHours) * chartHeight;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="3,3"
                  opacity="0.9"
                />
                
                {/* Completed time line */}
                <polyline
                  points={graphData.map((point, index) => {
                    const x = padding.left + (index / Math.max(1, graphData.length - 1)) * chartWidth;
                    const y = padding.top + chartHeight - (point.completedTime / maxHours) * chartHeight;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                />
                
                {/* Milestone diamonds on estimated progress line */}
                {milestones.length > 0 && milestones
                  .filter(m => {
                    const milestoneDate = new Date(m.dueDate);
                    const startDate = new Date(project.startDate);
                    const endDate = new Date(project.endDate);
                    return milestoneDate >= startDate && milestoneDate <= endDate;
                  })
                  .map((milestone, index) => {
                    // Find the data point that corresponds to this milestone
                    const milestoneDate = new Date(milestone.dueDate);
                    const dataPointIndex = graphData.findIndex(point => {
                      const pointDate = new Date(point.date);
                      return pointDate.toDateString() === milestoneDate.toDateString();
                    });
                    
                    if (dataPointIndex === -1) return null;
                    
                    const dataPoint = graphData[dataPointIndex];
                    const x = padding.left + (dataPointIndex / Math.max(1, graphData.length - 1)) * chartWidth;
                    const y = padding.top + chartHeight - (dataPoint.estimatedProgress / maxHours) * chartHeight;
                    
                    return (
                      <g key={`milestone-${milestone.id}`}>
                        {/* Milestone diamond */}
                        <rect
                          x={x - 4}
                          y={y - 4}
                          width="8"
                          height="8"
                          fill="#10b981"
                          stroke="#059669"
                          strokeWidth="1"
                          transform={`rotate(45 ${x} ${y})`}
                          className="cursor-pointer hover:fill-emerald-600 transition-colors"
                        />
                      </g>
                    );
                  })}
              </>
            )}
          </svg>
          
          {/* Milestone diamond tooltips positioned absolutely over the SVG */}
          {milestones.length > 0 && milestones
            .filter(m => {
              const milestoneDate = new Date(m.dueDate);
              const startDate = new Date(project.startDate);
              const endDate = new Date(project.endDate);
              return milestoneDate >= startDate && milestoneDate <= endDate;
            })
            .map((milestone) => {
              // Find the data point that corresponds to this milestone
              const milestoneDate = new Date(milestone.dueDate);
              const dataPointIndex = graphData.findIndex(point => {
                const pointDate = new Date(point.date);
                return pointDate.toDateString() === milestoneDate.toDateString();
              });
              
              if (dataPointIndex === -1) return null;
              
              const dataPoint = graphData[dataPointIndex];
              
              // Calculate position as percentage of the SVG viewBox
              const xPercent = ((padding.left + (dataPointIndex / Math.max(1, graphData.length - 1)) * chartWidth) / svgWidth) * 100;
              const yPercent = ((padding.top + chartHeight - (dataPoint.estimatedProgress / maxHours) * chartHeight) / svgHeight) * 100;
              
              return (
                <Tooltip key={`milestone-tooltip-${milestone.id}`}>
                  <TooltipTrigger asChild>
                    <div
                      className="absolute w-4 h-4 cursor-pointer"
                      style={{
                        left: `${xPercent}%`,
                        top: `${yPercent}%`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 10
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <div className="font-medium">{milestone.name}</div>
                      <div className="text-gray-600">
                        {new Date(milestone.dueDate).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="text-gray-600">{milestone.timeAllocation}h allocated</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          
          {/* Legend */}
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <svg width="20" height="2">
                <line x1="0" y1="1" x2="20" y2="1" stroke="#10b981" strokeWidth="2" strokeDasharray="5,5" opacity="0.8" />
              </svg>
              <span className="text-sm text-gray-700">Estimated Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="20" height="2">
                <line x1="0" y1="1" x2="20" y2="1" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3,3" opacity="0.9" />
              </svg>
              <span className="text-sm text-gray-700">Planned Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <svg width="20" height="2">
                <line x1="0" y1="1" x2="20" y2="1" stroke="#3b82f6" strokeWidth="3" />
              </svg>
              <span className="text-sm text-gray-700">Completed Time</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <div className="text-center">
            <p className="text-sm">Not enough data to display progress graph</p>
            <p className="text-xs mt-1">Project needs at least 2 days to show progress</p>
          </div>
        </div>
      )}
      </div>
    </TooltipProvider>
  );
}
