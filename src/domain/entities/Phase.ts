/**
 * Phase Domain Entity
 * 
 * Represents a time period within a project with allocated hours.
 * Phases divide a project's timeline and budget into manageable chunks.
 * 
 * This is a RICH DOMAIN MODEL - state + behavior together.
 * 
 * NOTE: Currently stored as "Milestone" in database.
 * Migration to "Phase" terminology is in progress.
 * 
 * @see docs/core/App Logic.md#4-phase - Entity definition
 * @see docs/core/Business Logic.md - Detailed business rules
 * @see docs/operations/MILESTONE_TO_PHASE_MIGRATION.md - Migration plan
 * @see docs/features/phases/PHASE_DOMAIN_LOGIC.md - Phase domain rules
 */

import type { Milestone, RecurringConfig } from '@/types/core';
import { PhaseRules } from '@/domain/rules/PhaseRules';
import { normalizeToMidnight } from '@/services/calculations/general/dateCalculations';
import type { DomainResult } from './Project';

/**
 * Phase creation parameters
 */
export interface CreatePhaseParams {
  name: string;
  projectId: string;
  startDate: Date;
  endDate: Date;
  timeAllocationHours: number;
  isRecurring?: boolean;
  recurringConfig?: RecurringConfig;
  userId: string;
}

/**
 * Phase update parameters (all optional except what changes)
 */
export interface UpdatePhaseParams {
  name?: string;
  startDate?: Date;
  endDate?: Date;
  timeAllocationHours?: number;
  recurringConfig?: RecurringConfig;
}

/**
 * Phase Domain Entity
 * 
 * Enforces business invariants and encapsulates phase behavior.
 * Cannot be created in an invalid state.
 * 
 * Key Rules:
 * 1. Phase must have both startDate and endDate (time period)
 * 2. endDate must be after startDate
 * 3. timeAllocationHours must be >= 0
 * 4. Recurring phases use pattern instead of fixed dates
 */
export class Phase {
  // Immutable core properties
  private readonly id: string;
  private readonly projectId: string;
  private readonly userId: string;
  private readonly createdAt: Date;
  
  // Mutable business properties
  private name: string;
  private startDate: Date;
  private endDate: Date;
  private timeAllocationHours: number;
  private isRecurring: boolean;
  private recurringConfig?: RecurringConfig;
  private updatedAt: Date;

  // Legacy fields (for backward compatibility)
  private dueDate: Date; // Synchronized with endDate
  private timeAllocation: number; // Synchronized with timeAllocationHours

  private constructor(data: Milestone) {
    // Direct assignment - validation happens in factory methods
    this.id = data.id;
    this.projectId = data.projectId;
    this.userId = data.userId;
    this.name = data.name;
    this.startDate = normalizeToMidnight(new Date(data.startDate!));
    this.endDate = normalizeToMidnight(new Date(data.endDate));
    this.timeAllocationHours = data.timeAllocationHours;
    this.isRecurring = data.isRecurring ?? false;
    this.recurringConfig = data.recurringConfig;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);

    // Legacy fields (synchronized)
    this.dueDate = this.endDate;
    this.timeAllocation = this.timeAllocationHours;
  }

  // ============================================================================
  // FACTORY METHODS - Enforce invariants at creation
  // ============================================================================

  /**
   * Create a new phase (not yet persisted)
   * 
   * Validates all business rules before construction.
   * Cannot create an invalid phase.
   * 
   * @param params - Phase creation parameters
   * @returns Result with phase or validation errors
   */
  static create(params: CreatePhaseParams): DomainResult<Phase> {
    const errors: string[] = [];

    // RULE 1: Phase name must be valid
    if (!params.name || params.name.trim().length === 0) {
      errors.push('Phase name is required');
    } else if (params.name.trim().length > 100) {
      errors.push('Phase name must be 100 characters or less');
    }

    // RULE 2: Phase must have valid date range
    const normalizedStart = normalizeToMidnight(params.startDate);
    const normalizedEnd = normalizeToMidnight(params.endDate);

    if (normalizedEnd <= normalizedStart) {
      errors.push('Phase end date must be after start date');
    }

    // RULE 3: Time allocation must be non-negative
    if (params.timeAllocationHours < 0) {
      errors.push('Phase time allocation cannot be negative');
    }

    // RULE 4: Recurring phases must have valid configuration
    if (params.isRecurring && !params.recurringConfig) {
      errors.push('Recurring phases must have recurring configuration');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const phaseData: Milestone = {
      id: crypto.randomUUID(),
      name: params.name.trim(),
      projectId: params.projectId,
      startDate: normalizedStart,
      endDate: normalizedEnd,
      dueDate: normalizedEnd, // Legacy: synchronized with endDate
      timeAllocationHours: params.timeAllocationHours,
      timeAllocation: params.timeAllocationHours, // Legacy: synchronized
      isRecurring: params.isRecurring ?? false,
      recurringConfig: params.recurringConfig,
      userId: params.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return {
      success: true,
      data: new Phase(phaseData)
    };
  }

  /**
   * Reconstitute a phase from database data
   * 
   * Use this when loading existing phases from the database.
   * Assumes data is already valid (was validated on creation).
   * 
   * @param data - Phase/Milestone data from database
   * @returns Phase entity
   */
  static fromDatabase(data: Milestone): Phase {
    // Ensure we have a startDate for phases
    if (!data.startDate) {
      throw new Error('Cannot create Phase from Milestone without startDate');
    }
    return new Phase(data);
  }

  // ============================================================================
  // BUSINESS OPERATIONS
  // ============================================================================

  /**
   * Update phase details
   * 
   * Validates all business rules before applying changes.
   * 
   * @param params - Fields to update
   * @returns Result with updated state or validation errors
   */
  update(params: UpdatePhaseParams): DomainResult<void> {
    const errors: string[] = [];

    // Validate name if provided
    if (params.name !== undefined) {
      if (params.name.trim().length === 0) {
        errors.push('Phase name is required');
      } else if (params.name.trim().length > 100) {
        errors.push('Phase name must be 100 characters or less');
      }
    }

    // Validate date range if either date is provided
    if (params.startDate || params.endDate) {
      const newStart = params.startDate ? normalizeToMidnight(params.startDate) : this.startDate;
      const newEnd = params.endDate ? normalizeToMidnight(params.endDate) : this.endDate;

      if (newEnd <= newStart) {
        errors.push('Phase end date must be after start date');
      }
    }

    // Validate time allocation if provided
    if (params.timeAllocationHours !== undefined && params.timeAllocationHours < 0) {
      errors.push('Phase time allocation cannot be negative');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Apply updates
    if (params.name !== undefined) this.name = params.name.trim();
    if (params.startDate !== undefined) this.startDate = normalizeToMidnight(params.startDate);
    if (params.endDate !== undefined) {
      this.endDate = normalizeToMidnight(params.endDate);
      this.dueDate = this.endDate; // Keep legacy field synchronized
    }
    if (params.timeAllocationHours !== undefined) {
      this.timeAllocationHours = params.timeAllocationHours;
      this.timeAllocation = params.timeAllocationHours; // Keep legacy field synchronized
    }
    if (params.recurringConfig !== undefined) this.recurringConfig = params.recurringConfig;
    this.updatedAt = new Date();

    return { success: true };
  }

  /**
   * Convert phase to recurring template
   * 
   * @param config - Recurring pattern configuration
   */
  convertToRecurring(config: RecurringConfig): void {
    this.isRecurring = true;
    this.recurringConfig = config;
    this.updatedAt = new Date();
  }

  /**
   * Convert recurring template back to fixed phase
   */
  convertToFixed(): void {
    this.isRecurring = false;
    this.recurringConfig = undefined;
    this.updatedAt = new Date();
  }

  // ============================================================================
  // QUERY METHODS - Read current state
  // ============================================================================

  /**
   * Check if this is a recurring phase template
   */
  isRecurringTemplate(): boolean {
    return this.isRecurring;
  }

  /**
   * Get phase duration in days
   */
  getDurationDays(): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil((this.endDate.getTime() - this.startDate.getTime()) / msPerDay);
  }

  /**
   * Get average hours per day for this phase
   */
  getAverageHoursPerDay(): number {
    const days = this.getDurationDays();
    return days > 0 ? this.timeAllocationHours / days : 0;
  }

  /**
   * Check if phase contains a specific date
   * 
   * @param date - Date to check
   * @returns True if date falls within phase period
   */
  containsDate(date: Date): boolean {
    const normalized = normalizeToMidnight(date);
    return normalized >= this.startDate && normalized <= this.endDate;
  }

  /**
   * Check if phase overlaps with another phase
   * 
   * @param other - Another phase to check against
   * @returns True if phases overlap
   */
  overlaps(other: Phase): boolean {
    return this.startDate < other.endDate && this.endDate > other.startDate;
  }

  /**
   * Get recurring pattern summary (for recurring phases)
   */
  getRecurringPattern(): string | null {
    if (!this.isRecurring || !this.recurringConfig) return null;

    const { type, interval } = this.recurringConfig;
    const intervalText = interval === 1 ? '' : `every ${interval} `;

    switch (type) {
      case 'daily':
        return `${intervalText}day${interval > 1 ? 's' : ''}`;
      case 'weekly':
        return `${intervalText}week${interval > 1 ? 's' : ''}`;
      case 'monthly':
        return `${intervalText}month${interval > 1 ? 's' : ''}`;
      default:
        return null;
    }
  }

  // ============================================================================
  // DATA CONVERSION - For persistence layer
  // ============================================================================

  /**
   * Convert to plain data object for database persistence
   * 
   * @returns Plain milestone data object
   */
  toData(): Milestone {
    return {
      id: this.id,
      name: this.name,
      projectId: this.projectId,
      startDate: this.startDate,
      endDate: this.endDate,
      dueDate: this.dueDate, // Legacy
      timeAllocationHours: this.timeAllocationHours,
      timeAllocation: this.timeAllocation, // Legacy
      isRecurring: this.isRecurring,
      recurringConfig: this.recurringConfig,
      userId: this.userId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // ============================================================================
  // GETTERS - Read-only access to properties
  // ============================================================================

  getId(): string { return this.id; }
  getName(): string { return this.name; }
  getProjectId(): string { return this.projectId; }
  getStartDate(): Date { return this.startDate; }
  getEndDate(): Date { return this.endDate; }
  getTimeAllocationHours(): number { return this.timeAllocationHours; }
  getIsRecurring(): boolean { return this.isRecurring; }
  getRecurringConfig(): RecurringConfig | undefined { return this.recurringConfig; }
  getUserId(): string { return this.userId; }
  getCreatedAt(): Date { return this.createdAt; }
  getUpdatedAt(): Date { return this.updatedAt; }

  // Legacy getters (for backward compatibility)
  getDueDate(): Date { return this.dueDate; }
  getTimeAllocation(): number { return this.timeAllocation; }
}
