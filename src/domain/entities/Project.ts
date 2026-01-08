/**
 * Project Domain Entity
 * 
 * Represents a piece of work with time estimates and deadlines.
 * Encapsulates all business rules and validation for projects.
 * 
 * This is a RICH DOMAIN MODEL - state + behavior together.
 * 
 * @see docs/core/App Logic.md#3-project - Entity definition
 * @see docs/core/Business Logic.md - Detailed business rules
 */

import type { Project as ProjectData, Phase, Client, ProjectStatus } from '@/types/core';
import { ProjectRules } from '@/domain/rules/projects/ProjectValidation';
import { normalizeToMidnight } from '@/utils/dateCalculations';

/**
 * Result of domain operations - success or validation errors
 */
export interface DomainResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
}

/**
 * Project creation parameters
 */
export interface CreateProjectParams {
  name: string;
  clientId: string; // UUID of existing client (orchestrators must resolve client name → clientId first)
  startDate: Date;
  endDate?: Date; // Required for time-limited, null for continuous
  estimatedHours: number;
  groupId: string;
  color: string;
  continuous?: boolean;
  status?: ProjectStatus;
  notes?: string;
  icon?: string;
  userId: string;
  existingPhases?: Phase[]; // Optional: for validating project not fully in past
}

/**
 * Project Domain Entity
 * 
 * Enforces business invariants and encapsulates project behavior.
 * Cannot be created in an invalid state.
 */
export class Project {
  // Immutable core properties
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _createdAt: Date;
  
  // Mutable business properties
  private _name: string;
  private _clientId: string;
  private _startDate: Date;
  private _endDate: Date | null;
  private _estimatedHours: number;
  private _groupId: string;
  private _color: string;
  private _continuous: boolean;
  private _status: ProjectStatus;
  private _notes?: string;
  private _icon?: string;
  private _updatedAt: Date;
  
  // Relationships (loaded separately)
  private _phases: Phase[];
  private _clientData?: Client;

  // ============================================================================
  // PUBLIC GETTERS - Backward compatibility for migration (Phase 2a)
  // ============================================================================
  
  get id(): string { return this._id; }
  get userId(): string { return this._userId; }
  get name(): string { return this._name; }
  get clientId(): string { return this._clientId; }
  get startDate(): Date { return this._startDate; }
  get endDate(): Date | null { return this._endDate; }
  get estimatedHours(): number { return this._estimatedHours; }
  get groupId(): string { return this._groupId; }
  get color(): string { return this._color; }
  get continuous(): boolean { return this._continuous; }
  get status(): ProjectStatus { return this._status; }
  get notes(): string | undefined { return this._notes; }
  get icon(): string | undefined { return this._icon; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get phases(): Phase[] { return this._phases; }
  get clientData(): Client | undefined { return this._clientData; }

  private constructor(data: ProjectData) {
    // Direct assignment - validation happens in factory methods
    this._id = data.id;
    this._userId = data.userId;
    this._name = data.name;
    this._clientId = data.clientId;
    this._startDate = normalizeToMidnight(new Date(data.startDate));
    this._endDate = data.endDate ? normalizeToMidnight(new Date(data.endDate)) : null;
    this._estimatedHours = data.estimatedHours;
    this._groupId = data.groupId;
    this._color = data.color;
    this._continuous = data.continuous ?? false;
    this._status = data.status ?? 'current';
    this._notes = data.notes;
    this._icon = data.icon;
    this._createdAt = new Date(data.createdAt);
    this._updatedAt = new Date(data.updatedAt);
    this._phases = data.phases ?? [];
    this._clientData = data.clientData;
  }

  // ============================================================================
  // FACTORY METHODS - Enforce invariants at creation
  // ============================================================================

  /**
   * Create a new project (not yet persisted)
   * Validates all business rules before construction
   * 
   * @see App Logic.md - Project Key Rules
   */
  static create(params: CreateProjectParams): DomainResult<Project> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Rule: Name required (1-100 characters)
    if (!params.name || params.name.trim().length === 0) {
      errors.push('Project name is required');
    } else if (params.name.length > 100) {
      errors.push('Project name must be 100 characters or less');
    }

    // Rule: Must have client
    if (!params.clientId || params.clientId.trim().length === 0) {
      errors.push('Project must have a client');
    }

    // Rule: Must have group
    if (!params.groupId) {
      errors.push('Project must belong to a group');
    }

    // Rule: Start date required
    if (!params.startDate) {
      errors.push('Project start date is required');
    }

    // Rule: Estimated hours must be >= 0
    if (!ProjectRules.validateEstimatedHours(params.estimatedHours)) {
      errors.push('Estimated hours must be 0 or greater');
    }

    // Rule: Large hours warning (matches orchestrator)
    if (params.estimatedHours > 10000) {
      warnings.push('Project estimated hours is very large (>10,000 hours)');
    }

    // Rule: Time-limited projects must have end date after start date
    if (!params.continuous) {
      if (!params.endDate) {
        errors.push('Time-limited projects must have an end date');
      } else if (!ProjectRules.validateDateRange(params.startDate, params.endDate)) {
        errors.push('Project end date must be after start date');
      }
    }

    // Rule: Continuous projects should not have end date
    if (params.continuous && params.endDate) {
      errors.push('Continuous projects should not have an end date');
    }

    // Note: Projects CAN be created in the past with estimated hours.
    // The "fully in past" validation only affects timeline rendering (auto-estimates),
    // not entity creation. This allows historical projects with time estimates.

    if (errors.length > 0) {
      return { 
        success: false, 
        errors,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    }

    // Construct with valid data
    const projectData: ProjectData = {
      id: crypto.randomUUID(),
      name: params.name.trim(),
      client: '', // Deprecated field - kept for backward compatibility
      clientId: params.clientId,
      startDate: normalizeToMidnight(params.startDate),
      endDate: params.continuous ? new Date(0) : normalizeToMidnight(params.endDate!), // Placeholder for continuous
      estimatedHours: params.estimatedHours,
      groupId: params.groupId,
      color: params.color,
      continuous: params.continuous ?? false,
      status: params.status ?? 'current',
      notes: params.notes,
      icon: params.icon ?? 'folder',
      userId: params.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return {
      success: true,
      data: new Project(projectData),
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Reconstitute from database (already validated)
   * Use when loading existing projects from persistence
   */
  static fromDatabase(data: ProjectData): Project {
    return new Project(data);
  }

  // ============================================================================
  // BUSINESS BEHAVIOR - Methods that change state
  // ============================================================================

  /**
   * Update project dates
   * Validates new date range before applying changes
   * 
   * @see Business Logic.md - Rule 3: Project date validity
   */
  updateDates(startDate: Date, endDate: Date | null): DomainResult<void> {
    if (this.continuous && endDate !== null) {
      return {
        success: false,
        errors: ['Continuous projects cannot have an end date'],
      };
    }

    if (!this.continuous && endDate === null) {
      return {
        success: false,
        errors: ['Time-limited projects must have an end date'],
      };
    }

    if (endDate && !ProjectRules.validateDateRange(startDate, endDate)) {
      return {
        success: false,
        errors: ['End date must be after start date'],
      };
    }

    // Validate against phases if they exist
    if (this._phases.length > 0 && endDate) {
      // Check that phases fit within new project dates
      for (const phase of this._phases) {
        const phaseEndDate = phase.endDate || phase.dueDate;
        if (phaseEndDate < startDate || phaseEndDate > endDate) {
          return {
            success: false,
            errors: [`Phase "${phase.name || 'Unnamed'}" falls outside new project date range`],
          };
        }
      }
    }

    this._startDate = normalizeToMidnight(startDate);
    this._endDate = endDate ? normalizeToMidnight(endDate) : null;
    this._updatedAt = new Date();

    return { success: true };
  }

  /**
   * Update project budget (estimated hours)
   * Validates against phase allocations
   * 
   * @see Business Logic.md - Rule 4: Positive time allocations
   */
  updateEstimatedHours(hours: number): DomainResult<void> {
    if (!ProjectRules.validateEstimatedHours(hours)) {
      return {
        success: false,
        errors: ['Estimated hours must be 0 or greater'],
      };
    }

    // Validate against phase allocations
    if (this._phases.length > 0) {
      const validation = ProjectRules.validateProjectTime(hours, this._phases);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }
    }

    this._estimatedHours = hours;
    this._updatedAt = new Date();

    return { success: true };
  }

  /**
   * Convert time-limited project to continuous
   * 
   * @see App Logic.md - Continuous vs Time-Limited Projects
   */
  convertToContinuous(): DomainResult<void> {
    if (this._continuous) {
      return {
        success: false,
        errors: ['Project is already continuous'],
      };
    }

    // Check if phases would be invalid
    if (this._phases.length > 0) {
      // Continuous projects can still have phases with deadlines
      // No validation needed - phases keep their absolute end dates
    }

    this._continuous = true;
    this._endDate = null;
    this._updatedAt = new Date();

    return { success: true };
  }

  /**
   * Convert continuous project to time-limited
   * Requires providing an end date
   */
  convertToTimeLimited(endDate: Date): DomainResult<void> {
    if (!this._continuous) {
      return {
        success: false,
        errors: ['Project is already time-limited'],
      };
    }

    if (!ProjectRules.validateDateRange(this._startDate, endDate)) {
      return {
        success: false,
        errors: ['End date must be after start date'],
      };
    }

    // Validate against phases
    if (this._phases.length > 0) {
      // Check that phases fit within new end date
      for (const phase of this._phases) {
        const phaseEndDate = phase.endDate || phase.dueDate;
        if (phaseEndDate < this._startDate || phaseEndDate > endDate) {
          return {
            success: false,
            errors: [`Phase "${phase.name || 'Unnamed'}" falls outside project date range`],
          };
        }
      }
    }

    this._continuous = false;
    this._endDate = normalizeToMidnight(endDate);
    this._updatedAt = new Date();

    return { success: true };
  }

  /**
   * Change project status
   */
  updateStatus(status: ProjectStatus): void {
    this._status = status;
    this._updatedAt = new Date();
  }

  /**
   * Update basic properties
   */
  updateProperties(updates: {
    name?: string;
    notes?: string;
    color?: string;
    icon?: string;
  }): DomainResult<void> {
    const errors: string[] = [];

    if (updates.name !== undefined) {
      if (updates.name.trim().length === 0) {
        errors.push('Project name cannot be empty');
      } else if (updates.name.length > 100) {
        errors.push('Project name must be 100 characters or less');
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    if (updates.name) this._name = updates.name.trim();
    if (updates.notes !== undefined) this._notes = updates.notes;
    if (updates.color) this._color = updates.color;
    if (updates.icon) this._icon = updates.icon;
    this._updatedAt = new Date();

    return { success: true };
  }

  // ============================================================================
  // QUERIES - Read-only calculations and checks
  // ============================================================================

  /**
   * Check if project is time-limited (has deadline)
   */
  isTimeLimited(): boolean {
    return !this._continuous && this._endDate !== null;
  }

  /**
   * Check if project is continuous (no deadline)
   */
  isContinuous(): boolean {
    return this._continuous;
  }

  /**
   * Get project duration in days
   * Returns null for continuous projects
   */
  getDurationDays(): number | null {
    if (this._continuous || !this._endDate) {
      return null;
    }

    const start = this._startDate.getTime();
    const end = this._endDate.getTime();
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * Calculate daily work allocation
   * Returns null for continuous projects (no daily distribution)
   */
  getDailyAllocationHours(): number | null {
    const duration = this.getDurationDays();
    if (duration === null || duration === 0) {
      return null;
    }
    return this._estimatedHours / duration;
  }

  /**
   * Check if project is active on given date
   */
  isActiveOnDate(date: Date): boolean {
    const checkDate = normalizeToMidnight(date);
    
    if (checkDate < this._startDate) {
      return false;
    }

    if (this._continuous) {
      return true; // Continuous projects are always active after start
    }

    return this._endDate ? checkDate <= this._endDate : false;
  }

  /**
   * Check if project is currently active (today)
   */
  isCurrentlyActive(): boolean {
    return this.isActiveOnDate(new Date());
  }

  /**
   * Get budget analysis vs phase allocations
   */
  getBudgetAnalysis(): ReturnType<typeof ProjectRules.analyzeBudget> {
    return ProjectRules.analyzeBudget(this.toData(), this._phases);
  }

  // ============================================================================
  // RELATIONSHIP MANAGEMENT
  // ============================================================================

  /**
   * Set phases (typically loaded from database)
   */
  setPhases(phases: Phase[]): void {
    this._phases = phases;
  }

  /**
   * Set client data (from join)
   */
  setClientData(client: Client): void {
    this._clientData = client;
  }

  // ============================================================================
  // DATA CONVERSION - For persistence and API
  // ============================================================================

  /**
   * Convert to plain data object for database/API
   */
  toData(): ProjectData {
    return {
      id: this._id,
      name: this._name,
      client: '', // Deprecated field - kept for backward compatibility
      clientId: this._clientId,
      startDate: this._startDate,
      endDate: this._continuous ? new Date(0) : (this._endDate ?? new Date(0)), // Use epoch for continuous or null
      estimatedHours: this._estimatedHours,
      groupId: this._groupId,
      color: this._color,
      continuous: this._continuous,
      status: this._status,
      notes: this._notes,
      icon: this._icon,
      userId: this._userId,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      phases: this._phases,
      clientData: this._clientData,
    };
  }

  /**
   * Get read-only snapshot of project state
   */
  getSnapshot() {
    return {
      id: this._id,
      name: this._name,
      clientId: this._clientId,
      startDate: new Date(this._startDate),
      endDate: this._continuous ? null : (this._endDate ? new Date(this._endDate) : null),
      estimatedHours: this._estimatedHours,
      groupId: this._groupId,
      color: this._color,
      continuous: this._continuous,
      status: this._status,
      notes: this._notes,
      icon: this._icon,
      isTimeLimited: this.isTimeLimited(),
      isContinuous: this.isContinuous(),
      durationDays: this.getDurationDays(),
      dailyAllocationHours: this.getDailyAllocationHours(),
      createdAt: new Date(this._createdAt),
      updatedAt: new Date(this._updatedAt),
    };
  }
}
