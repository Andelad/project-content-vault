import React, { useMemo } from 'react';
import { Project, CalendarEvent, Milestone } from '@/types/core';
import { ProjectTimeMetrics } from '@/lib/projectCalculations';
import { analyzeProjectProgress } from '@/services';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';

interface ProjectProgressGraphProps {
  project: Project;
  metrics: ProjectTimeMetrics;
  events: CalendarEvent[];
  milestones?: Milestone[];
}

export function ProjectProgressGraph({ project, metrics, events, milestones = [] }: ProjectProgressGraphProps) {
  // Use the comprehensive progress analysis service
  const analysis = useMemo(() => {
    return analyzeProjectProgress({
      project,
      events,
      milestones,
      includeEventDatePoints: true,
      maxDataPoints: 20
    });
  }, [project, events, milestones]);

  const { progressData: graphData, maxHours } = analysis;

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
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
                
                {/* Completed time line */}
                <polyline
                  points={graphData.map((point, index) => {
                    const x = padding.left + (index / Math.max(1, graphData.length - 1)) * chartWidth;
                    const y = padding.top + chartHeight - (point.completedTime / maxHours) * chartHeight;
                    return `${x},${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                />
                
                {/* Planned time step line */}
                {graphData.map((point, index) => {
                  if (index === 0) return null;
                  
                  const prevPoint = graphData[index - 1];
                  const x1 = padding.left + ((index - 1) / Math.max(1, graphData.length - 1)) * chartWidth;
                  const x2 = padding.left + (index / Math.max(1, graphData.length - 1)) * chartWidth;
                  const y = padding.top + chartHeight - (prevPoint.plannedTime / maxHours) * chartHeight;
                  
                  return (
                    <g key={`planned-step-${index}`}>
                      {/* Horizontal line (step) */}
                      <line
                        x1={x1}
                        y1={y}
                        x2={x2}
                        y2={y}
                        stroke="#f59e0b"
                        strokeWidth="2"
                      />
                      {/* Vertical line (jump) */}
                      {point.plannedTime !== prevPoint.plannedTime && (
                        <line
                          x1={x2}
                          y1={y}
                          x2={x2}
                          y2={padding.top + chartHeight - (point.plannedTime / maxHours) * chartHeight}
                          stroke="#f59e0b"
                          strokeWidth="2"
                        />
                      )}
                    </g>
                  );
                })}
              </>
            )}
            
            {/* Data points with tooltips */}
            {graphData.map((point, index) => {
              const x = padding.left + (index / Math.max(1, graphData.length - 1)) * chartWidth;
              const estimatedY = padding.top + chartHeight - (point.estimatedProgress / maxHours) * chartHeight;
              const completedY = padding.top + chartHeight - (point.completedTime / maxHours) * chartHeight;
              const plannedY = padding.top + chartHeight - (point.plannedTime / maxHours) * chartHeight;
              
              return (
                <g key={`point-${index}`}>
                  {/* Estimated progress point */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <circle
                        cx={x}
                        cy={estimatedY}
                        r="4"
                        fill="#3b82f6"
                        stroke="white"
                        strokeWidth="2"
                        className="cursor-pointer hover:r-6"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        <div className="font-medium">{point.date.toLocaleDateString()}</div>
                        <div className="text-blue-600">Estimated: {point.estimatedProgress.toFixed(1)}h</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* Completed time point */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <circle
                        cx={x}
                        cy={completedY}
                        r="4"
                        fill="#10b981"
                        stroke="white"
                        strokeWidth="2"
                        className="cursor-pointer hover:r-6"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        <div className="font-medium">{point.date.toLocaleDateString()}</div>
                        <div className="text-green-600">Completed: {point.completedTime.toFixed(1)}h</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* Planned time point */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <circle
                        cx={x}
                        cy={plannedY}
                        r="3"
                        fill="#f59e0b"
                        stroke="white"
                        strokeWidth="2"
                        className="cursor-pointer hover:r-5"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        <div className="font-medium">{point.date.toLocaleDateString()}</div>
                        <div className="text-yellow-600">Planned: {point.plannedTime.toFixed(1)}h</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div className="flex gap-6 justify-center mt-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-blue-500 border-dashed border border-blue-500"></div>
              <span className="text-gray-700">Estimated Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-green-500"></div>
              <span className="text-gray-700">Completed Time</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-yellow-500"></div>
              <span className="text-gray-700">Planned Time</span>
            </div>
          </div>

          {/* Progress insights */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="font-medium text-blue-900">Progress Method</div>
              <div className="text-blue-700 capitalize">{analysis.progressMethod}-based</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="font-medium text-green-900">Completion Rate</div>
              <div className="text-green-700">{analysis.completionRate.toFixed(1)}%</div>
            </div>
            <div className={`p-3 rounded-lg ${analysis.isOnTrack ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className={`font-medium ${analysis.isOnTrack ? 'text-green-900' : 'text-red-900'}`}>
                On Track
              </div>
              <div className={analysis.isOnTrack ? 'text-green-700' : 'text-red-700'}>
                {analysis.isOnTrack ? 'Yes' : 'Behind Schedule'}
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No progress data available for this project.
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}