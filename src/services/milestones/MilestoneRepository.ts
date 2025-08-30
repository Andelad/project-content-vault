/**
 * Milestone Repository
 * 
 * Handles data access patterns for milestones.
 * Abstracts database operations and provides clean interface for business logic.
 * 
 * ✅ Encapsulates data access
 * ✅ Provides consistent interface
 * ✅ Can be mocked for testing
 */

import { Milestone } from '@/types/core';

export interface CreateMilestoneRequest {
  name: string;
  dueDate: Date;
  timeAllocation: number;
  projectId: string;
  order?: number;
}

export interface UpdateMilestoneRequest {
  id: string;
  name?: string;
  dueDate?: Date;
  timeAllocation?: number;
  order?: number;
}

export interface MilestoneQueryFilters {
  projectId?: string;
  startDate?: Date;
  endDate?: Date;
  minTimeAllocation?: number;
  maxTimeAllocation?: number;
}

/**
 * Milestone Repository Interface
 * 
 * Defines the contract for milestone data operations.
 * Can be implemented with different backends (Supabase, local storage, etc.)
 */
export interface IMilestoneRepository {
  // Basic CRUD operations
  getById(id: string): Promise<Milestone | null>;
  getByProjectId(projectId: string): Promise<Milestone[]>;
  getAll(filters?: MilestoneQueryFilters): Promise<Milestone[]>;
  create(request: CreateMilestoneRequest): Promise<Milestone>;
  update(request: UpdateMilestoneRequest): Promise<Milestone>;
  delete(id: string): Promise<void>;

  // Batch operations
  createMany(requests: CreateMilestoneRequest[]): Promise<Milestone[]>;
  updateMany(requests: UpdateMilestoneRequest[]): Promise<Milestone[]>;
  deleteMany(ids: string[]): Promise<void>;

  // Query operations
  findByDateRange(startDate: Date, endDate: Date): Promise<Milestone[]>;
  findByTimeAllocationRange(min: number, max: number): Promise<Milestone[]>;
  findConflictingDates(projectId: string, date: Date, excludeId?: string): Promise<Milestone[]>;
}

/**
 * Mock Milestone Repository (for testing and development)
 * 
 * Provides in-memory implementation for testing purposes.
 * Can be replaced with real database implementation.
 */
export class MockMilestoneRepository implements IMilestoneRepository {
  private milestones: Map<string, Milestone> = new Map();
  private nextId = 1;

  async getById(id: string): Promise<Milestone | null> {
    return this.milestones.get(id) || null;
  }

  async getByProjectId(projectId: string): Promise<Milestone[]> {
    return Array.from(this.milestones.values()).filter(m => m.projectId === projectId);
  }

  async getAll(filters?: MilestoneQueryFilters): Promise<Milestone[]> {
    let milestones = Array.from(this.milestones.values());

    if (filters) {
      if (filters.projectId) {
        milestones = milestones.filter(m => m.projectId === filters.projectId);
      }
      if (filters.startDate) {
        milestones = milestones.filter(m => m.dueDate >= filters.startDate!);
      }
      if (filters.endDate) {
        milestones = milestones.filter(m => m.dueDate <= filters.endDate!);
      }
      if (filters.minTimeAllocation !== undefined) {
        milestones = milestones.filter(m => m.timeAllocation >= filters.minTimeAllocation!);
      }
      if (filters.maxTimeAllocation !== undefined) {
        milestones = milestones.filter(m => m.timeAllocation <= filters.maxTimeAllocation!);
      }
    }

    return milestones;
  }

  async create(request: CreateMilestoneRequest): Promise<Milestone> {
    const milestone: Milestone = {
      id: `milestone_${this.nextId++}`,
      name: request.name,
      dueDate: request.dueDate,
      timeAllocation: request.timeAllocation,
      projectId: request.projectId,
      order: request.order || 1
    };

    this.milestones.set(milestone.id, milestone);
    return milestone;
  }

  async update(request: UpdateMilestoneRequest): Promise<Milestone> {
    const existing = this.milestones.get(request.id);
    if (!existing) {
      throw new Error(`Milestone with id ${request.id} not found`);
    }

    const updated: Milestone = {
      ...existing,
      ...(request.name !== undefined && { name: request.name }),
      ...(request.dueDate !== undefined && { dueDate: request.dueDate }),
      ...(request.timeAllocation !== undefined && { timeAllocation: request.timeAllocation }),
      ...(request.order !== undefined && { order: request.order })
    };

    this.milestones.set(updated.id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.milestones.delete(id);
  }

  async createMany(requests: CreateMilestoneRequest[]): Promise<Milestone[]> {
    const created: Milestone[] = [];
    for (const request of requests) {
      created.push(await this.create(request));
    }
    return created;
  }

  async updateMany(requests: UpdateMilestoneRequest[]): Promise<Milestone[]> {
    const updated: Milestone[] = [];
    for (const request of requests) {
      updated.push(await this.update(request));
    }
    return updated;
  }

  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Milestone[]> {
    return this.getAll({ startDate, endDate });
  }

  async findByTimeAllocationRange(min: number, max: number): Promise<Milestone[]> {
    return this.getAll({ minTimeAllocation: min, maxTimeAllocation: max });
  }

  async findConflictingDates(projectId: string, date: Date, excludeId?: string): Promise<Milestone[]> {
    const milestones = await this.getByProjectId(projectId);
    return milestones.filter(m => 
      m.id !== excludeId &&
      m.dueDate.getTime() === date.getTime()
    );
  }

  // Test helpers
  clear(): void {
    this.milestones.clear();
    this.nextId = 1;
  }

  size(): number {
    return this.milestones.size;
  }
}

// Export singleton instance for easy use
export const milestoneRepository = new MockMilestoneRepository();
