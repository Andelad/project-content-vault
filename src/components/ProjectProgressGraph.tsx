import React, { useMemo } from 'react';
import { Project, CalendarEvent } from '@/types/core';
import { ProjectTimeMetrics } from '@/lib/projectCalculations';

interface ProjectProgressGraphProps {
  project: Project;
  metrics: ProjectTimeMetrics;
  events: CalendarEvent[];
}

interface DataPoint {
  date: Date;
  estimatedProgress: number;
  completedTime: number;
}

export function ProjectProgressGraph({ project, metrics, events }: ProjectProgressGraphProps) {
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
    
    // Daily rate for linear progression (total estimated hours divided by project days)
    const dailyEstimatedRate = project.estimatedHours / Math.max(1, totalDays);
    
    // Generate data points for each day in the project range
    for (let i = 0; i <= totalDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      // Linear estimated progress based on project timeline
      const estimatedProgress = Math.min(project.estimatedHours, dailyEstimatedRate * i);
      
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
      
      data.push({
        date: currentDate,
        estimatedProgress,
        completedTime
      });
    }
    
    return data;
  }, [project, events]);

  const maxHours = Math.max(project.estimatedHours, metrics.completedTime, 1);
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
              </>
            )}
          </svg>
          
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
  );
}
