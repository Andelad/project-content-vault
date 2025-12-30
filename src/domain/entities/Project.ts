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
import { ProjectRules } from '@/domain/rules/ProjectRules';
import { normalizeToMidnight } from '@/services/calculations/general/dateCalculations';

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
  private readonly id: string;
  private readonly userId: string;
  private readonly createdAt: Date;
  
  // Mutable business properties
  private name: string;
  private clientId: string;
  private startDate: Date;
  private endDate: Date | null;
  private estimatedHours: number;
  private groupId: string;
  private color: string;
  private continuous: boolean;
  private status: ProjectStatus;
  private notes?: string;
  private icon?: string;
  private updatedAt: Date;
  
  // Relationships (loaded separately)
  private phases: Phase[];
  private clientData?: Client;

  private constructor(data: ProjectData) {
    // Direct assignment - validation happens in factory methods
    this.id = data.id;
    this.userId = data.userId;
    this.name = data.name;
    this.clientId = data.clientId;
    this.startDate = normalizeToMidnight(new Date(data.startDate));
    this.endDate = data.endDate ? normalizeToMidnight(new Date(data.endDate)) : null;
    this.estimatedHours = data.estimatedHours;
    this.groupId = data.groupId;
    this.color = data.color;
    this.continuous = data.continuous ?? false;
    this.status = data.status ?? 'current';
    this.notes = data.notes;
    this.icon = data.icon;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
    this.phases = data.phases ?? [];
    this.clientData = data.clientData;
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
    // Note: clientId can be empty string during creation - will be resolved by orchestrator
    // Only validate if a clientId is provided
    if (params.clientId && params.clientId.trim().length === 0) {
      // Empty string is allowed as placeholder, but if provided, must be valid
      // This is fine - orchestrator will resolve it
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

    // Rule: Projects with estimated hours cannot be fully in the past (matches orchestrator)
    if (params.estimatedHours > 0 && params.startDate && !errors.length) {
      // Create temporary project data for validation
      const tempProjectData: ProjectData = {
        id: 'temp',
        name: params.name,
        client: '', // Deprecated field
        clientId: params.clientId,
        startDate: params.startDate,
        endDate: params.continuous ? new Date() : (params.endDate || new Date()),
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
        phases: []
      };

      const pastValidation = ProjectRules.validateProjectNotFullyInPast(
        tempProjectData,
        params.existingPhases || []
      );

      if (!pastValidation.isValid) {
        errors.push(...pastValidation.errors);
      }
    }

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
    if (this.phases.length > 0 && endDate) {
      // Check that phases fit within new project dates
      for (const phase of this.phases) {
        const phaseEndDate = phase.endDate || phase.dueDate;
        if (phaseEndDate < startDate || phaseEndDate > endDate) {
          return {
            success: false,
            errors: [`Phase "${phase.name || 'Unnamed'}" falls outside new project date range`],
          };
        }
      }
    }

    this.startDate = normalizeToMidnight(startDate);
    this.endDate = endDate ? normalizeToMidnight(endDate) : null;
    this.updatedAt = new Date();

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
    if (this.phases.length > 0) {
      const validation = ProjectRules.validateProjectTime(hours, this.phases);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }
    }

    this.estimatedHours = hours;
    this.updatedAt = new Date();

    return { success: true };
  }

  /**
   * Convert time-limited project to continuous
   * 
   * @see App Logic.md - Continuous vs Time-Limited Projects
   */
  convertToContinuous(): DomainResult<void> {
    if (this.continuous) {
      return {
        success: false,
        errors: ['Project is already continuous'],
      };
    }

    // Check if phases would be invalid
    if (this.phases.length > 0) {
      // Continuous projects can still have phases with deadlines
      // No validation needed - phases keep their absolute end dates
    }

    this.continuous = true;
    this.endDate = null;
    this.updatedAt = new Date();

    return { success: true };
  }

  /**
   * Convert continuous project to time-limited
   * Requires providing an end date
   */
  convertToTimeLimited(endDate: Date): DomainResult<void> {
    if (!this.continuous) {
      return {
        success: false,
        errors: ['Project is already time-limited'],
      };
    }

    if (!ProjectRules.validateDateRange(this.startDate, endDate)) {
      return {
        success: false,
        errors: ['End date must be after start date'],
      };
    }

    // Validate against phases
    if (this.phases.length > 0) {
      // Check that phases fit within new end date
      for (const phase of this.phases) {
        const phaseEndDate = phase.endDate || phase.dueDate;
        if (phaseEndDate < this.startDate || phaseEndDate > endDate) {
          return {
            success: false,
            errors: [`Phase "${phase.name || 'Unnamed'}" falls outside project date range`],
          };
        }
      }
    }

    this.continuous = false;
    this.endDate = normalizeToMidnight(endDate);
    this.updatedAt = new Date();

    return { success: true };
  }

  /**
   * Change project status
   */
  updateStatus(status: ProjectStatus): void {
    this.status = status;
    this.updatedAt = new Date();
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

    if (updates.name) this.name = updates.name.trim();
    if (updates.notes !== undefined) this.notes = updates.notes;
    if (updates.color) this.color = updates.color;
    if (updates.icon) this.icon = updates.icon;
    this.updatedAt = new Date();

    return { success: true };
  }

  // ============================================================================
  // QUERIES - Read-only calculations and checks
  // ============================================================================

  /**
   * Check if project is time-limited (has deadline)
   */
  isTimeLimited(): boolean {
    return !this.continuous && this.endDate !== null;
  }

  /**
   * Check if project is continuous (no deadline)
   */
  isContinuous(): boolean {
    return this.continuous;
  }

  /**
   * Get project duration in days
   * Returns null for continuous projects
   */
  getDurationDays(): number | null {
    if (this.continuous || !this.endDate) {
      return null;
    }

    const start = this.startDate.getTime();
    const end = this.endDate.getTime();
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
    return this.estimatedHours / duration;
  }

  /**
   * Check if project is active on given date
   */
  isActiveOnDate(date: Date): boolean {
    const checkDate = normalizeToMidnight(date);
    
    if (checkDate < this.startDate) {
      return false;
    }

    if (this.continuous) {
      return true; // Continuous projects are always active after start
    }

    return this.endDate ? checkDate <= this.endDate : false;
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
    return ProjectRules.analyzeBudget(this.toData(), this.phases);
  }

  // ============================================================================
  // RELATIONSHIP MANAGEMENT
  // ============================================================================

  /**
   * Set phases (typically loaded from database)
   */
  setPhases(phases: Phase[]): void {
    this.phases = phases;
  }

  /**
   * Set client data (from join)
   */
  setClientData(client: Client): void {
    this.clientData = client;
  }

  // ============================================================================
  // DATA CONVERSION - For persistence and API
  // ============================================================================

  /**
   * Convert to plain data object for database/API
   */
  toData(): ProjectData {
    return {
      id: this.id,
      name: this.name,
      client: '', // Deprecated field - kept for backward compatibility
      clientId: this.clientId,
      startDate: this.startDate,
      endDate: this.continuous ? new Date(0) : (this.endDate ?? new Date(0)), // Use epoch for continuous or null
      estimatedHours: this.estimatedHours,
      groupId: this.groupId,
      color: this.color,
      continuous: this.continuous,
      status: this.status,
      notes: this.notes,
      icon: this.icon,
      userId: this.userId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      phases: this.phases,
      clientData: this.clientData,
    };
  }

  /**
   * Get read-only snapshot of project state
   */
  getSnapshot() {
    return {
      id: this.id,
      name: this.name,
      clientId: this.clientId,
      startDate: new Date(this.startDate),
      endDate: this.continuous ? null : (this.endDate ? new Date(this.endDate) : null),
      estimatedHours: this.estimatedHours,
      groupId: this.groupId,
      color: this.color,
      continuous: this.continuous,
      status: this.status,
      notes: this.notes,
      icon: this.icon,
      isTimeLimited: this.isTimeLimited(),
      isContinuous: this.isContinuous(),
      durationDays: this.getDurationDays(),
      dailyAllocationHours: this.getDailyAllocationHours(),
      createdAt: new Date(this.createdAt),
      updatedAt: new Date(this.updatedAt),
    };
  }
}
