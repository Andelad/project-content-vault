/**
 * Project Repository Implementation
 * 
 * Domain-specific repository for Project entities with:
 * - Advanced project querying capabilities
 * - Timeline-based filtering and optimization
 * - Project-milestone relationship management
 * - Status and progress tracking integration
 * 
 * @module ProjectRepository
 */

import type { Project, Milestone } from '@/types/core';
import { UnifiedRepository } from './UnifiedRepository';
import type { ITimestampedRepository, RepositoryConfig, SyncResult } from './IBaseRepository';
import { ProjectValidator, type ProjectValidationContext } from '../validators/ProjectValidator';

// =====================================================================================
// PROJECT-SPECIFIC INTERFACES
// =====================================================================================

export interface IProjectRepository extends ITimestampedRepository<Project & { createdAt: Date; updatedAt: Date }> {
  // Project-specific queries
  findByStatus(status: string): Promise<(Project & { createdAt: Date; updatedAt: Date })[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<(Project & { createdAt: Date; updatedAt: Date })[]>;
  findOverlapping(startDate: Date, endDate: Date): Promise<(Project & { createdAt: Date; updatedAt: Date })[]>;
  findByGroup(groupId: string): Promise<(Project & { createdAt: Date; updatedAt: Date })[]>;
  findByRow(rowId: string): Promise<(Project & { createdAt: Date; updatedAt: Date })[]>;
  
  // Project analytics
  getProjectStats(): Promise<ProjectStats>;
  getBudgetAnalysis(projectId: string): Promise<ProjectBudgetAnalysis>;
  getTimelineAnalysis(projectIds: string[]): Promise<TimelineAnalysis>;
  
  // Project relationships
  findWithMilestones(projectId: string): Promise<ProjectWithMilestones>;
  findProjectsByMilestone(milestoneId: string): Promise<(Project & { createdAt: Date; updatedAt: Date })[]>;
  
  // Advanced operations
  archiveProject(projectId: string): Promise<boolean>;
  restoreProject(projectId: string): Promise<boolean>;
  duplicateProject(projectId: string, newName: string): Promise<Project & { createdAt: Date; updatedAt: Date }>;
}

export interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  onTrackProjects: number;
  delayedProjects: number;
  averageDuration: number;
  totalBudgetHours: number;
  utilizationRate: number;
}

export interface ProjectBudgetAnalysis {
  projectId: string;
  estimatedHours: number;
  allocatedHours: number;
  remainingHours: number;
  utilizationPercentage: number;
  isOverBudget: boolean;
  milestoneBreakdown: Array<{
    milestoneId: string;
    name: string;
    allocatedHours: number;
    percentage: number;
  }>;
}

export interface TimelineAnalysis {
  totalDuration: number;
  criticalPath: string[];
  parallelProjects: string[][];
  resourceConflicts: Array<{
    date: Date;
    conflictingProjects: string[];
    severity: 'low' | 'medium' | 'high';
  }>;
  recommendedScheduleAdjustments: Array<{
    projectId: string;
    currentStart: Date;
    recommendedStart: Date;
    reason: string;
  }>;
}

export interface ProjectWithMilestones extends Project {
  milestones: Milestone[];
  milestoneCount: number;
  completedMilestoneCount: number;
  totalMilestoneHours: number;
  nextMilestone: Milestone | null;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================================================
// PROJECT REPOSITORY IMPLEMENTATION
// =====================================================================================

export class ProjectRepository extends UnifiedRepository<Project & { createdAt: Date; updatedAt: Date }> implements IProjectRepository {
  
  constructor(config?: Partial<RepositoryConfig>) {
    super('Project', {
      cache: {
        enabled: true,
        ttl: 10 * 60 * 1000, // 10 minutes for projects
        maxSize: 500,
        ...config?.cache
      },
      validation: {
        enabled: true,
        validateOnCreate: true,
        validateOnUpdate: true,
        ...config?.validation
      },
      ...config
    });
  }

  // -------------------------------------------------------------------------------------
  // ABSTRACT METHOD IMPLEMENTATIONS
  // -------------------------------------------------------------------------------------

  protected async executeCreate(entity: Omit<Project & { createdAt: Date; updatedAt: Date }, 'id'>): Promise<Project & { createdAt: Date; updatedAt: Date }> {
    const project = {
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...entity
    };
    
    await this.simulateDelay();
    return project as Project & { createdAt: Date; updatedAt: Date };
  }

  protected async executeUpdate(id: string, updates: Partial<Project & { createdAt: Date; updatedAt: Date }>): Promise<Project & { createdAt: Date; updatedAt: Date }> {
    const existing = await this.executeFindById(id);
    if (!existing) {
      throw new Error(`Project with id ${id} not found`);
    }
    
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    
    await this.simulateDelay();
    return updated;
  }

  protected async executeDelete(id: string): Promise<boolean> {
    await this.simulateDelay();
    return true;
  }

  protected async executeFindById(id: string): Promise<(Project & { createdAt: Date; updatedAt: Date }) | null> {
    await this.simulateDelay();
    return null; // Would implement actual data source lookup
  }

  protected async executeFindAll(): Promise<(Project & { createdAt: Date; updatedAt: Date })[]> {
    await this.simulateDelay();
    return [];
  }

  protected async executeFindBy(criteria: Partial<Project & { createdAt: Date; updatedAt: Date }>): Promise<(Project & { createdAt: Date; updatedAt: Date })[]> {
    await this.simulateDelay();
    return [];
  }

  protected async executeCount(criteria?: Partial<Project & { createdAt: Date; updatedAt: Date }>): Promise<number> {
    await this.simulateDelay();
    return 0;
  }

  protected async executeSyncToServer(): Promise<SyncResult> {
    const offlineChanges = await this.getOfflineChanges();
    await this.simulateDelay(1000);
    
    return {
      success: true,
      syncedCount: offlineChanges.length,
      conflictCount: 0,
      errors: [],
      conflicts: [],
      duration: 1000
    };
  }

  // -------------------------------------------------------------------------------------
  // TIMESTAMPED REPOSITORY METHODS
  // -------------------------------------------------------------------------------------

  async findByCreatedDate(startDate: Date, endDate?: Date): Promise<(Project & { createdAt: Date; updatedAt: Date })[]> {
    const allProjects = await this.findAll();
    return allProjects.filter(project => {
      const created = project.createdAt;
      return created >= startDate && (!endDate || created <= endDate);
    });
  }

  async findByUpdatedDate(startDate: Date, endDate?: Date): Promise<(Project & { createdAt: Date; updatedAt: Date })[]> {
    const allProjects = await this.findAll();
    return allProjects.filter(project => {
      const updated = project.updatedAt;
      return updated >= startDate && (!endDate || updated <= endDate);
    });
  }

  async findRecentlyCreated(hours: number): Promise<(Project & { createdAt: Date; updatedAt: Date })[]> {
    const cutoffDate = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return await this.findByCreatedDate(cutoffDate);
  }

  async findRecentlyUpdated(hours: number): Promise<(Project & { createdAt: Date; updatedAt: Date })[]> {
    const cutoffDate = new Date(Date.now() - (hours * 60 * 60 * 1000));
    return await this.findByUpdatedDate(cutoffDate);
  }

  // -------------------------------------------------------------------------------------
  // PROJECT-SPECIFIC METHODS
  // -------------------------------------------------------------------------------------

  async findByStatus(status: string): Promise<(Project & { createdAt: Date; updatedAt: Date })[]> {
    return await this.findBy({ status } as any);
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<(Project & { createdAt: Date; updatedAt: Date })[]> {
    const allProjects = await this.findAll();
    return allProjects.filter(project =>
      project.startDate >= startDate && 
      (project.endDate ? project.endDate <= endDate : project.startDate <= endDate)
    );
  }

  async findOverlapping(startDate: Date, endDate: Date): Promise<(Project & { createdAt: Date; updatedAt: Date })[]> {
    const allProjects = await this.findAll();
    return allProjects.filter(project =>
      project.startDate < endDate && 
      (project.endDate ? project.endDate > startDate : project.startDate >= startDate)
    );
  }

  async findByGroup(groupId: string): Promise<(Project & { createdAt: Date; updatedAt: Date })[]> {
    return await this.findBy({ groupId } as any);
  }

  async findByRow(rowId: string): Promise<(Project & { createdAt: Date; updatedAt: Date })[]> {
    return await this.findBy({ rowId } as any);
  }

  // -------------------------------------------------------------------------------------
  // PROJECT ANALYTICS
  // -------------------------------------------------------------------------------------

  async getProjectStats(): Promise<ProjectStats> {
    const allProjects = await this.findAll();
    
    return {
      totalProjects: allProjects.length,
      activeProjects: allProjects.filter(p => p.status === 'current').length,
      completedProjects: allProjects.filter(p => p.status === 'archived').length,
      onTrackProjects: allProjects.filter(p => this.isProjectOnTrack(p)).length,
      delayedProjects: allProjects.filter(p => this.isProjectDelayed(p)).length,
      averageDuration: this.calculateAverageDuration(allProjects),
      totalBudgetHours: allProjects.reduce((sum, p) => sum + p.estimatedHours, 0),
      utilizationRate: this.calculateUtilizationRate(allProjects)
    };
  }

  async getBudgetAnalysis(projectId: string): Promise<ProjectBudgetAnalysis> {
    const project = await this.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const milestones: Milestone[] = []; // Would fetch from MilestoneRepository
    const allocatedHours = milestones.reduce((sum, m) => sum + m.timeAllocation, 0);
    const remainingHours = Math.max(0, project.estimatedHours - allocatedHours);
    const utilizationPercentage = (allocatedHours / project.estimatedHours) * 100;

    return {
      projectId,
      estimatedHours: project.estimatedHours,
      allocatedHours,
      remainingHours,
      utilizationPercentage,
      isOverBudget: allocatedHours > project.estimatedHours,
      milestoneBreakdown: milestones.map(milestone => ({
        milestoneId: milestone.id,
        name: milestone.name,
        allocatedHours: milestone.timeAllocation,
        percentage: (milestone.timeAllocation / project.estimatedHours) * 100
      }))
    };
  }

  async getTimelineAnalysis(projectIds: string[]): Promise<TimelineAnalysis> {
    const projects = await Promise.all(projectIds.map(id => this.findById(id)));
    const validProjects = projects.filter((p): p is Project & { createdAt: Date; updatedAt: Date } => p !== null);

    return {
      totalDuration: this.calculateTotalDuration(validProjects),
      criticalPath: this.calculateCriticalPath(validProjects),
      parallelProjects: [],
      resourceConflicts: [],
      recommendedScheduleAdjustments: []
    };
  }

  // -------------------------------------------------------------------------------------
  // PROJECT RELATIONSHIPS
  // -------------------------------------------------------------------------------------

  async findWithMilestones(projectId: string): Promise<ProjectWithMilestones> {
    const project = await this.findById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const milestones: Milestone[] = [];
    const completedMilestones = milestones.filter(m => m.dueDate < new Date()); // Use due date as completion indicator
    const totalMilestoneHours = milestones.reduce((sum, m) => sum + m.timeAllocation, 0);
    const nextMilestone = milestones
      .filter(m => m.dueDate >= new Date()) // Future milestones
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0] || null;

    return {
      ...project,
      milestones,
      milestoneCount: milestones.length,
      completedMilestoneCount: completedMilestones.length,
      totalMilestoneHours,
      nextMilestone
    };
  }

  async findProjectsByMilestone(milestoneId: string): Promise<(Project & { createdAt: Date; updatedAt: Date })[]> {
    // Would implement actual milestone-project relationship lookup
    return [];
  }

  // -------------------------------------------------------------------------------------
  // ADVANCED OPERATIONS
  // -------------------------------------------------------------------------------------

  async archiveProject(projectId: string): Promise<boolean> {
    const updated = await this.update(projectId, { status: 'archived' } as any);
    return updated !== null;
  }

  async restoreProject(projectId: string): Promise<boolean> {
    const updated = await this.update(projectId, { status: 'current' } as any);
    return updated !== null;
  }

  async duplicateProject(projectId: string, newName: string): Promise<Project & { createdAt: Date; updatedAt: Date }> {
    const original = await this.findById(projectId);
    if (!original) {
      throw new Error(`Project ${projectId} not found`);
    }

    const { id, createdAt, updatedAt, ...duplicateData } = original;
    
    return await this.create({
      ...duplicateData,
      name: newName,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // -------------------------------------------------------------------------------------
  // PRIVATE HELPER METHODS
  // -------------------------------------------------------------------------------------

  private generateId(): string {
    return `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async simulateDelay(ms: number = 100): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private isProjectOnTrack(project: Project): boolean {
    return project.status === 'current';
  }

  private isProjectDelayed(project: Project): boolean {
    if (!project.endDate) return false;
    return project.endDate < new Date() && project.status !== 'archived';
  }

  private calculateAverageDuration(projects: (Project & { createdAt: Date; updatedAt: Date })[]): number {
    if (projects.length === 0) return 0;
    
    const totalDuration = projects
      .filter(p => p.endDate)
      .reduce((sum, p) => {
        const duration = p.endDate!.getTime() - p.startDate.getTime();
        return sum + (duration / (1000 * 60 * 60 * 24)); // Convert to days
      }, 0);
    
    return totalDuration / projects.length;
  }

  private calculateUtilizationRate(projects: (Project & { createdAt: Date; updatedAt: Date })[]): number {
    const totalHours = projects.reduce((sum, p) => sum + p.estimatedHours, 0);
    const completedProjects = projects.filter(p => p.status === 'archived');
    const completedHours = completedProjects.reduce((sum, p) => sum + p.estimatedHours, 0);
    
    return totalHours > 0 ? (completedHours / totalHours) * 100 : 0;
  }

  private calculateTotalDuration(projects: (Project & { createdAt: Date; updatedAt: Date })[]): number {
    if (projects.length === 0) return 0;
    
    const earliestStart = Math.min(...projects.map(p => p.startDate.getTime()));
    const latestEnd = Math.max(...projects.map(p => (p.endDate || new Date()).getTime()));
    
    return (latestEnd - earliestStart) / (1000 * 60 * 60 * 24); // Days
  }

  private calculateCriticalPath(projects: (Project & { createdAt: Date; updatedAt: Date })[]): string[] {
    return projects
      .filter(p => this.isProjectDelayed(p) || p.status === 'current')
      .map(p => p.id);
  }
}
