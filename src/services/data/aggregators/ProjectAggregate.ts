/**
 * Project Aggregate
 * 
 * Combines project data with related entities (phases, events, client).
 * 
 * ✅ ONLY aggregates data from multiple sources (no business logic)
 * ✅ Uses mappers to transform DB data
 * ✅ Returns enriched domain DTOs
 * 
 * Architecture Layer: services/data/aggregators/
 * - Fetches data from multiple tables
 * - Combines related entities
 * - NO business logic (that belongs in domain/rules/)
 * - NO validation (that belongs in domain/rules/)
 */

import { supabase } from '@/integrations/supabase/client';
import { ProjectMapper, PhaseMapper, CalendarEventMapper, ClientMapper } from '../mappers';
import type { Project, PhaseDTO, CalendarEvent, Client } from '@/types/core';

/**
 * Enriched project with all related data
 */
export interface ProjectWithRelations extends Project {
  phases: PhaseDTO[];
  events: CalendarEvent[];
  clientData?: Client;
}

/**
 * Project Data Aggregator
 * 
 * Fetches and combines project data with related entities.
 */
export const ProjectAggregate = {
  /**
   * Fetch a single project with all related data
   * 
   * Includes:
   * - Project details
   * - All phases for the project
   * - All events linked to the project
   * - Client data (if available)
   */
  async fetchWithRelations(projectId: string): Promise<ProjectWithRelations | null> {
    // Fetch project
    const { data: projectRow, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !projectRow) {
      return null;
    }

    const project = ProjectMapper.fromDatabase(projectRow);

    // Fetch phases
    const { data: phaseRows, error: phasesError } = await supabase
      .from('phases')
      .select('*')
      .eq('project_id', projectId)
      .order('end_date', { ascending: true });

    const phases = phasesError || !phaseRows 
      ? [] 
      : phaseRows.map(PhaseMapper.fromDatabase);

    // Fetch events
    const { data: eventRows, error: eventsError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('project_id', projectId)
      .order('start_time', { ascending: true });

    const events = eventsError || !eventRows
      ? []
      : eventRows.map(CalendarEventMapper.fromDatabase);

    // Fetch client (if exists)
    let clientData: Client | undefined;
    if (project.clientId) {
      const { data: clientRow, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', project.clientId)
        .single();

      if (!clientError && clientRow) {
        clientData = ClientMapper.fromDatabase(clientRow);
      }
    }

    return {
      ...project,
      phases,
      events,
      clientData,
    };
  },

  /**
   * Fetch all projects for a user with their phases
   * 
   * Lighter than fetchWithRelations - only includes phases, not events or client.
   * Use this for list views.
   */
  async fetchAllWithPhases(userId: string): Promise<ProjectWithRelations[]> {
    // Fetch all projects
    const { data: projectRows, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: true });

    if (projectsError || !projectRows) {
      return [];
    }

    const projects = projectRows.map(ProjectMapper.fromDatabase);

    // Fetch all phases for these projects
    const projectIds = projects.map(p => p.id);
    const { data: phaseRows, error: phasesError } = await supabase
      .from('phases')
      .select('*')
      .in('project_id', projectIds)
      .order('end_date', { ascending: true });

    const phases = phasesError || !phaseRows
      ? []
      : phaseRows.map(PhaseMapper.fromDatabase);

    // Group phases by project
    const phasesByProject = new Map<string, PhaseDTO[]>();
    phases.forEach(phase => {
      const existing = phasesByProject.get(phase.projectId) ?? [];
      phasesByProject.set(phase.projectId, [...existing, phase]);
    });

    // Combine projects with their phases
    return projects.map(project => ({
      ...project,
      phases: phasesByProject.get(project.id) ?? [],
      events: [], // Not included in this lighter query
    }));
  },
};
