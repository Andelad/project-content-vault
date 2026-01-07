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

import type { PhaseDTO, RecurringConfig } from '@/types/core';
import type { Database, Json } from '@/integrations/supabase/types';
import { PhaseRules } from '@/domain/rules/phases/PhaseRules';
import { normalizeToMidnight } from '@/utils/dateCalculations';
import type { DomainResult } from './Project';

type PhaseRow = Database['public']['Tables']['phases']['Row'];

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
  private readonly _id: string;
  private readonly _projectId: string;
  private readonly _userId: string;
  private readonly _createdAt: Date;
  
  // Mutable business properties
  private _name: string;
  private _startDate: Date;
  private _endDate: Date;
  private _timeAllocationHours: number;
  private _isRecurring: boolean;
  private _recurringConfig?: RecurringConfig;
  private _updatedAt: Date;

  // Legacy fields (for backward compatibility)
  private _dueDate: Date; // Synchronized with endDate
  private _timeAllocation: number; // Synchronized with timeAllocationHours

  // ============================================================================
  // PUBLIC GETTERS - Backward compatibility for migration (Phase 2a)
  // ============================================================================
  
  get id(): string { return this._id; }
  get projectId(): string { return this._projectId; }
  get userId(): string { return this._userId; }
  get name(): string { return this._name; }
  get startDate(): Date { return this._startDate; }
  get endDate(): Date { return this._endDate; }
  get timeAllocationHours(): number { return this._timeAllocationHours; }
  get isRecurring(): boolean { return this._isRecurring; }
  get recurringConfig(): RecurringConfig | undefined { return this._recurringConfig; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get dueDate(): Date { return this._dueDate; } // Legacy
  get timeAllocation(): number { return this._timeAllocation; } // Legacy

  private constructor(data: PhaseDTO) {
    // Direct assignment - validation happens in factory methods
    this._id = data.id;
    this._projectId = data.projectId;
    this._userId = data.userId;
    this._name = data.name;
    this._startDate = normalizeToMidnight(new Date(data.startDate!));
    this._endDate = normalizeToMidnight(new Date(data.endDate));
    this._timeAllocationHours = data.timeAllocationHours;
    this._isRecurring = data.isRecurring ?? false;
    this._recurringConfig = data.recurringConfig;
    this._createdAt = new Date(data.createdAt);
    this._updatedAt = new Date(data.updatedAt);

    // Legacy fields (synchronized)
    this._dueDate = this._endDate;
    this._timeAllocation = this._timeAllocationHours;
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

    const phaseData: PhaseDTO = {
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
   * @param data - Phase/Milestone data from database (snake_case)
   * @returns Phase entity
   */
  static fromDatabase(data: PhaseRow): Phase {
    // Convert database format (snake_case) to entity format (camelCase)
    const phaseData: PhaseDTO = {
      id: data.id,
      projectId: data.project_id,
      userId: data.user_id,
      name: data.name,
      startDate: new Date(data.start_date),
      endDate: new Date(data.end_date),
      timeAllocationHours: data.time_allocation_hours,
      isRecurring: data.is_recurring,
      recurringConfig: data.recurring_config ? (data.recurring_config as unknown as RecurringConfig) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      // Legacy fields for backward compatibility
      dueDate: new Date(data.end_date),
      timeAllocation: data.time_allocation,
    };
    
    return new Phase(phaseData);
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
    if (params.name !== undefined) this._name = params.name.trim();
    if (params.startDate !== undefined) this._startDate = normalizeToMidnight(params.startDate);
    if (params.endDate !== undefined) {
      this._endDate = normalizeToMidnight(params.endDate);
      this._dueDate = this._endDate; // Keep legacy field synchronized
    }
    if (params.timeAllocationHours !== undefined) {
      this._timeAllocationHours = params.timeAllocationHours;
      this._timeAllocation = params.timeAllocationHours; // Keep legacy field synchronized
    }
    if (params.recurringConfig !== undefined) this._recurringConfig = params.recurringConfig;
    this._updatedAt = new Date();

    return { success: true };
  }

  /**
   * Convert phase to recurring template
   * 
   * @param config - Recurring pattern configuration
   */
  convertToRecurring(config: RecurringConfig): void {
    this._isRecurring = true;
    this._recurringConfig = config;
    this._updatedAt = new Date();
  }

  /**
   * Convert recurring template back to fixed phase
   */
  convertToFixed(): void {
    this._isRecurring = false;
    this._recurringConfig = undefined;
    this._updatedAt = new Date();
  }

  // ============================================================================
  // QUERY METHODS - Read current state
  // ============================================================================

  /**
   * Check if this is a recurring phase template
   */
  isRecurringTemplate(): boolean {
    return this._isRecurring;
  }

  /**
   * Get phase duration in days
   */
  getDurationDays(): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil((this._endDate.getTime() - this._startDate.getTime()) / msPerDay);
  }

  /**
   * Get average hours per day for this phase
   */
  getAverageHoursPerDay(): number {
    const days = this.getDurationDays();
    return days > 0 ? this._timeAllocationHours / days : 0;
  }

  /**
   * Check if phase contains a specific date
   * 
   * @param date - Date to check
   * @returns True if date falls within phase period
   */
  containsDate(date: Date): boolean {
    const normalized = normalizeToMidnight(date);
    return normalized >= this._startDate && normalized <= this._endDate;
  }

  /**
   * Check if phase overlaps with another phase
   * 
   * @param other - Another phase to check against
   * @returns True if phases overlap
   */
  overlaps(other: Phase): boolean {
    return this._startDate < other.endDate && this._endDate > other.startDate;
  }

  /**
   * Get recurring pattern summary (for recurring phases)
   */
  getRecurringPattern(): string | null {
    if (!this._isRecurring || !this._recurringConfig) return null;

    const { type, interval } = this._recurringConfig;
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
   * Convert to plain data object for database persistence or transfer
   * 
   * @returns Plain phase data transfer object
   */
  toDTO(): PhaseDTO {
    return {
      id: this._id,
      name: this._name,
      projectId: this._projectId,
      startDate: this._startDate,
      endDate: this._endDate,
      dueDate: this._dueDate, // Legacy
      timeAllocationHours: this._timeAllocationHours,
      timeAllocation: this._timeAllocation, // Legacy
      isRecurring: this._isRecurring,
      recurringConfig: this._recurringConfig,
      userId: this._userId,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
    };
  }
  
  /**
   * @deprecated Use toDTO() instead. This method exists for backward compatibility.
   */
  toData(): PhaseDTO {
    return this.toDTO();
  }

  // ============================================================================
  // GETTERS - Read-only access to properties
  // ============================================================================

  getId(): string { return this._id; }
  getName(): string { return this._name; }
  getProjectId(): string { return this._projectId; }
  getStartDate(): Date { return this._startDate; }
  getEndDate(): Date { return this._endDate; }
  getTimeAllocationHours(): number { return this._timeAllocationHours; }
  getIsRecurring(): boolean { return this._isRecurring; }
  getRecurringConfig(): RecurringConfig | undefined { return this._recurringConfig; }
  getUserId(): string { return this._userId; }
  getCreatedAt(): Date { return this._createdAt; }
  getUpdatedAt(): Date { return this._updatedAt; }

  // Legacy getters (for backward compatibility)
  getDueDate(): Date { return this._dueDate; }
  getTimeAllocation(): number { return this._timeAllocation; }
}
