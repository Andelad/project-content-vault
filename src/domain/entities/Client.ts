/**
 * Client Domain Entity
 * 
 * Represents an organization or person that work is done for.
 * Encapsulates all business rules and validation for clients.
 * 
 * This is a RICH DOMAIN MODEL - state + behavior together.
 * 
 * @see docs/core/App Logic.md#2-client - Entity definition
 * @see docs/core/Business Logic.md - Detailed business rules
 */

import type { Client as ClientData, ClientStatus } from '@/types/core';
import { ClientRules } from '@/domain/rules/ClientRules';
import type { DomainResult } from './Project';

/**
 * Client creation parameters
 */
export interface CreateClientParams {
  name: string;
  status?: ClientStatus;
  contactEmail?: string;
  contactPhone?: string;
  billingAddress?: string;
  notes?: string;
  userId: string;
}

/**
 * Client update parameters (all optional except what changes)
 */
export interface UpdateClientParams {
  name?: string;
  status?: ClientStatus;
  contactEmail?: string;
  contactPhone?: string;
  billingAddress?: string;
  notes?: string;
}

/**
 * Client Domain Entity
 * 
 * Enforces business invariants and encapsulates client behavior.
 * Cannot be created in an invalid state.
 */
export class Client {
  // Immutable core properties
  private readonly id: string;
  private readonly userId: string;
  private readonly createdAt: Date;
  
  // Mutable business properties
  private name: string;
  private status: ClientStatus;
  private contactEmail?: string;
  private contactPhone?: string;
  private billingAddress?: string;
  private notes?: string;
  private updatedAt: Date;

  private constructor(data: ClientData) {
    // Direct assignment - validation happens in factory methods
    this.id = data.id;
    this.userId = data.userId;
    this.name = data.name;
    this.status = data.status;
    this.contactEmail = data.contactEmail;
    this.contactPhone = data.contactPhone;
    this.billingAddress = data.billingAddress;
    this.notes = data.notes;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
  }

  // ============================================================================
  // FACTORY METHODS - Enforce invariants at creation
  // ============================================================================

  /**
   * Create a new client (not yet persisted)
   * 
   * Validates all business rules before construction.
   * Cannot create an invalid client.
   * 
   * @param params - Client creation parameters
   * @returns Result with client or validation errors
   */
  static create(params: CreateClientParams): DomainResult<Client> {
    const errors: string[] = [];

    // RULE 1: Client name must be valid
    if (!ClientRules.validateClientName(params.name)) {
      errors.push('Client name must be between 1 and 100 characters');
    }

    // RULE 2: Email must be valid format (if provided)
    if (params.contactEmail && !ClientRules.validateClientEmail(params.contactEmail)) {
      errors.push('Contact email must be a valid email address');
    }

    // RULE 3: Phone must be valid format (if provided)
    if (params.contactPhone && !ClientRules.validateClientPhone(params.contactPhone)) {
      errors.push('Contact phone must contain only valid characters (digits, spaces, hyphens, parentheses, plus)');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const clientData: ClientData = {
      id: crypto.randomUUID(),
      name: params.name.trim(),
      status: params.status ?? 'active',
      contactEmail: params.contactEmail?.trim(),
      contactPhone: params.contactPhone?.trim(),
      billingAddress: params.billingAddress?.trim(),
      notes: params.notes?.trim(),
      userId: params.userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return {
      success: true,
      data: new Client(clientData)
    };
  }

  /**
   * Reconstitute a client from database data
   * 
   * Use this when loading existing clients from the database.
   * Assumes data is already valid (was validated on creation).
   * 
   * @param data - Client data from database
   * @returns Client entity
   */
  static fromDatabase(data: ClientData): Client {
    return new Client(data);
  }

  // ============================================================================
  // BUSINESS OPERATIONS
  // ============================================================================

  /**
   * Update client details
   * 
   * Validates all business rules before applying changes.
   * 
   * @param params - Fields to update
   * @returns Result with updated state or validation errors
   */
  update(params: UpdateClientParams): DomainResult<void> {
    const errors: string[] = [];

    // Validate name if provided
    if (params.name !== undefined && !ClientRules.validateClientName(params.name)) {
      errors.push('Client name must be between 1 and 100 characters');
    }

    // Validate email if provided
    if (params.contactEmail !== undefined && !ClientRules.validateClientEmail(params.contactEmail)) {
      errors.push('Contact email must be a valid email address');
    }

    // Validate phone if provided
    if (params.contactPhone !== undefined && !ClientRules.validateClientPhone(params.contactPhone)) {
      errors.push('Contact phone must contain only valid characters (digits, spaces, hyphens, parentheses, plus)');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Apply updates
    if (params.name !== undefined) this.name = params.name.trim();
    if (params.status !== undefined) this.status = params.status;
    if (params.contactEmail !== undefined) this.contactEmail = params.contactEmail?.trim();
    if (params.contactPhone !== undefined) this.contactPhone = params.contactPhone?.trim();
    if (params.billingAddress !== undefined) this.billingAddress = params.billingAddress?.trim();
    if (params.notes !== undefined) this.notes = params.notes?.trim();
    this.updatedAt = new Date();

    return { success: true };
  }

  /**
   * Activate the client
   */
  activate(): void {
    this.status = 'active';
    this.updatedAt = new Date();
  }

  /**
   * Deactivate the client
   */
  deactivate(): void {
    this.status = 'inactive';
    this.updatedAt = new Date();
  }

  /**
   * Archive the client
   */
  archive(): void {
    this.status = 'archived';
    this.updatedAt = new Date();
  }

  // ============================================================================
  // QUERY METHODS - Read current state
  // ============================================================================

  /**
   * Check if client is active
   */
  isActive(): boolean {
    return this.status === 'active';
  }

  /**
   * Check if client is archived
   */
  isArchived(): boolean {
    return this.status === 'archived';
  }

  /**
   * Get client's display name
   */
  getDisplayName(): string {
    return this.name;
  }

  /**
   * Check if client has contact information
   */
  hasContactInfo(): boolean {
    return !!(this.contactEmail || this.contactPhone);
  }

  // ============================================================================
  // DATA CONVERSION - For persistence layer
  // ============================================================================

  /**
   * Convert to plain data object for database persistence
   * 
   * @returns Plain client data object
   */
  toData(): ClientData {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      contactEmail: this.contactEmail,
      contactPhone: this.contactPhone,
      billingAddress: this.billingAddress,
      notes: this.notes,
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
  getStatus(): ClientStatus { return this.status; }
  getContactEmail(): string | undefined { return this.contactEmail; }
  getContactPhone(): string | undefined { return this.contactPhone; }
  getBillingAddress(): string | undefined { return this.billingAddress; }
  getNotes(): string | undefined { return this.notes; }
  getUserId(): string { return this.userId; }
  getCreatedAt(): Date { return this.createdAt; }
  getUpdatedAt(): Date { return this.updatedAt; }
}
