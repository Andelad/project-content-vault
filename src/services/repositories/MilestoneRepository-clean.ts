/**
 * Milestone Repository
 * 
 * Simplified milestone repository implementation that focuses on core functionality
 * and integrates properly with the existing repository system.
 */

import { UnifiedRepository } from './UnifiedRepository';
import type { IBaseRepository, RepositoryConfig, SyncResult } from './IBaseRepository';
import type { Milestone } from '../../types';

// =====================================================================================
// MILESTONE REPOSITORY INTERFACES
// =====================================================================================

export interface IMilestoneRepository extends IBaseRepository<Milestone> {
  findByProject(projectId: string): Promise<Milestone[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<Milestone[]>;
  findOverdue(): Promise<Milestone[]>;
  findUpcoming(days?: number): Promise<Milestone[]>;
  getProgressStats(projectId?: string): Promise<{
    total: number;
    completed: number;
    completionRate: number;
    overdueCount: number;
  }>;
}

// =====================================================================================
// MILESTONE REPOSITORY IMPLEMENTATION
// =====================================================================================

export class MilestoneRepository 
  extends UnifiedRepository<Milestone, string>
  implements IMilestoneRepository 
{
  protected entityName = 'milestone' as const;
  
  constructor(config?: RepositoryConfig) {
    super('milestone', config);
  }

  // -------------------------------------------------------------------------------------
  // ABSTRACT METHOD IMPLEMENTATIONS
  // -------------------------------------------------------------------------------------

  protected async executeCreate(data: Omit<Milestone, 'id'>): Promise<Milestone> {
    const milestone: Milestone = {
      id: `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data
    };
    
    this.cache.set(milestone.id, milestone);
    return milestone;
  }

  protected async executeUpdate(id: string, data: Partial<Milestone>): Promise<Milestone> {
    const existing = await this.executeFindById(id);
    if (!existing) {
      throw new Error(`Milestone not found: ${id}`);
    }
    
    const updated: Milestone = { ...existing, ...data };
    this.cache.set(id, updated);
    return updated;
  }

  protected async executeDelete(id: string): Promise<boolean> {
    const exists = await this.executeFindById(id);
    if (!exists) return false;
    
    this.cache.delete(id);
    return true;
  }

  protected async executeFindById(id: string): Promise<Milestone | null> {
    return this.cache.get(id) || null;
  }

  protected async executeFindByIds(ids: string[]): Promise<Milestone[]> {
    const results: Milestone[] = [];
    for (const id of ids) {
      const milestone = await this.executeFindById(id);
      if (milestone) {
        results.push(milestone);
      }
    }
    return results;
  }

  protected async executeFindAll(): Promise<Milestone[]> {
    // Simplified implementation - in a real system this would query the database
    return [];
  }

  protected async executeCount(): Promise<number> {
    const all = await this.executeFindAll();
    return all.length;
  }

  protected async executeExists(id: string): Promise<boolean> {
    const milestone = await this.executeFindById(id);
    return milestone !== null;
  }

  protected async executeFindBy(criteria: Partial<Milestone>): Promise<Milestone[]> {
    const all = await this.executeFindAll();
    return all.filter(milestone => {
      return Object.entries(criteria).every(([key, value]) => 
        (milestone as any)[key] === value
      );
    });
  }

  protected async executeSyncToServer(): Promise<SyncResult> {
    // Sync implementation would go here
    return { 
      success: true, 
      syncedCount: 0, 
      conflictCount: 0,
      errors: [], 
      conflicts: [],
      duration: 0
    };
  }

  // -------------------------------------------------------------------------------------
  // MILESTONE-SPECIFIC QUERIES
  // -------------------------------------------------------------------------------------

  async findByProject(projectId: string): Promise<Milestone[]> {
    const all = await this.findAll();
    return all.filter(milestone => milestone.projectId === projectId);
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Milestone[]> {
    const all = await this.findAll();
    return all.filter(milestone => 
      milestone.dueDate >= startDate && milestone.dueDate <= endDate
    );
  }

  async findOverdue(): Promise<Milestone[]> {
    const now = new Date();
    const all = await this.findAll();
    return all.filter(milestone => 
      milestone.dueDate < now && !milestone.name.toLowerCase().includes('completed')
    );
  }

  async findUpcoming(days = 7): Promise<Milestone[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const all = await this.findAll();
    return all.filter(milestone => 
      milestone.dueDate >= now && 
      milestone.dueDate <= futureDate &&
      !milestone.name.toLowerCase().includes('completed')
    );
  }

  async getProgressStats(projectId?: string): Promise<{
    total: number;
    completed: number;
    completionRate: number;
    overdueCount: number;
  }> {
    const milestones = projectId ? 
      await this.findByProject(projectId) : 
      await this.findAll();

    const total = milestones.length;
    const completed = milestones.filter(m => 
      m.name.toLowerCase().includes('completed')
    ).length;
    
    const completionRate = total > 0 ? (completed / total) * 100 : 0;
    
    const overdue = await this.findOverdue();
    const overdueCount = projectId ? 
      overdue.filter(m => m.projectId === projectId).length :
      overdue.length;
    
    return {
      total,
      completed,
      completionRate,
      overdueCount
    };
  }
}
