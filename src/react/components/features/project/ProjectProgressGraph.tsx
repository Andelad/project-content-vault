import React from 'react';
import { Project, CalendarEvent, PhaseDTO } from '@/types/core';

interface ProjectProgressGraphProps {
  project: Project;
  events: CalendarEvent[];
  milestones?: PhaseDTO[];
}

export function ProjectProgressGraph({ project, events, milestones = [] }: ProjectProgressGraphProps) {
  // TODO: Re-implement using new architecture
  // Previous implementation used deleted UnifiedProjectProgressService (analyzeProjectProgress)
  return (
    <div className="text-sm text-muted-foreground p-4 border rounded-lg">
      <div className="font-medium mb-2">Progress Graph</div>
      <div>Temporarily disabled during architecture migration. Will be reimplemented.</div>
    </div>
  );
}
