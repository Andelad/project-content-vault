/**
 * Project Repository Interface
 * 
 * Defines the contract for project data access operations.
 * Abstracts persistence details from business logic.
 * 
 * ✅ Clean interface for data operations
 * ✅ Testable with mock implementations
 * ✅ Supports different storage backends
 */

import { Project, Milestone } from '@/types/core';

/**
 * Repository interface for project data operations
 */
export interface IProjectRepository {
  /**
   * Find projects by various criteria
   */
  findById(id: string): Promise<Project | null>;
  findByName(name: string): Promise<Project | null>;
  findByStatus(status: string): Promise<Project[]>;
  findAll(): Promise<Project[]>;
  
  /**
   * Project CRUD operations
   */
  create(project: Omit<Project, 'id'>): Promise<Project>;
  update(id: string, updates: Partial<Project>): Promise<Project>;
  delete(id: string): Promise<void>;
  
  /**
   * Project-milestone relationship operations
   */
  findProjectMilestones(projectId: string): Promise<Milestone[]>;
  
  /**
   * Advanced project queries
   */
  findProjectsInDateRange(startDate: Date, endDate: Date): Promise<Project[]>;
  findOverBudgetProjects(): Promise<Project[]>;
  findProjectsByClient(client: string): Promise<Project[]>;
}

/**
 * Mock implementation for testing and development
 */
export class MockProjectRepository implements IProjectRepository {
  private projects: Project[] = [];
  private milestones: Milestone[] = [];

  async findById(id: string): Promise<Project | null> {
    return this.projects.find(p => p.id === id) || null;
  }

  async findByName(name: string): Promise<Project | null> {
    return this.projects.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
  }

  async findByStatus(status: string): Promise<Project[]> {
    return this.projects.filter(p => p.status === status);
  }

  async findAll(): Promise<Project[]> {
    return [...this.projects];
  }

  async create(projectData: Omit<Project, 'id'>): Promise<Project> {
    const project: Project = {
      ...projectData,
      id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    this.projects.push(project);
    return project;
  }

  async update(id: string, updates: Partial<Project>): Promise<Project> {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Project with id ${id} not found`);
    }
    
    this.projects[index] = { ...this.projects[index], ...updates };
    return this.projects[index];
  }

  async delete(id: string): Promise<void> {
    const index = this.projects.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Project with id ${id} not found`);
    }
    
    this.projects.splice(index, 1);
    // Also remove associated milestones
    this.milestones = this.milestones.filter(m => m.projectId !== id);
  }

  async findProjectMilestones(projectId: string): Promise<Milestone[]> {
    return this.milestones.filter(m => m.projectId === projectId);
  }

  async findProjectsInDateRange(startDate: Date, endDate: Date): Promise<Project[]> {
    return this.projects.filter(project => {
      // Check if project overlaps with the date range
      return project.startDate <= endDate && project.endDate >= startDate;
    });
  }

  async findOverBudgetProjects(): Promise<Project[]> {
    const overBudgetProjects: Project[] = [];
    
    for (const project of this.projects) {
      const milestones = await this.findProjectMilestones(project.id);
      const totalAllocation = milestones.reduce((sum, m) => sum + m.timeAllocation, 0);
      
      if (totalAllocation > project.estimatedHours) {
        overBudgetProjects.push(project);
      }
    }
    
    return overBudgetProjects;
  }

  async findProjectsByClient(client: string): Promise<Project[]> {
    return this.projects.filter(p => p.client.toLowerCase() === client.toLowerCase());
  }

  // Test helper methods
  addMockMilestone(milestone: Milestone): void {
    this.milestones.push(milestone);
  }

  addMockProject(project: Project): void {
    this.projects.push(project);
  }

  clearAllData(): void {
    this.projects = [];
    this.milestones = [];
  }

  getProjectCount(): number {
    return this.projects.length;
  }

  getMilestoneCount(): number {
    return this.milestones.length;
  }
}
