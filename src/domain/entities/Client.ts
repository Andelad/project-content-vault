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
import type { Database } from '@/integrations/supabase/types';
import { ClientRules } from '@/domain/rules/ClientRules';
import type { DomainResult } from './Project';

type ClientRow = Database['public']['Tables']['clients']['Row'];

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
  existingClients?: ClientData[]; // Optional: for duplicate name validation
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
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _createdAt: Date;
  
  // Mutable business properties
  private _name: string;
  private _status: ClientStatus;
  private _contactEmail?: string;
  private _contactPhone?: string;
  private _billingAddress?: string;
  private _notes?: string;
  private _updatedAt: Date;

  // ============================================================================
  // PUBLIC GETTERS - Backward compatibility for migration (Phase 2a)
  // ============================================================================
  
  get id(): string { return this._id; }
  get userId(): string { return this._userId; }
  get name(): string { return this._name; }
  get status(): ClientStatus { return this._status; }
  get contactEmail(): string | undefined { return this._contactEmail; }
  get contactPhone(): string | undefined { return this._contactPhone; }
  get billingAddress(): string | undefined { return this._billingAddress; }
  get notes(): string | undefined { return this._notes; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  private constructor(data: ClientData) {
    // Direct assignment - validation happens in factory methods
    this._id = data.id;
    this._userId = data.userId;
    this._name = data.name;
    this._status = data.status;
    this._contactEmail = data.contactEmail;
    this._contactPhone = data.contactPhone;
    this._billingAddress = data.billingAddress;
    this._notes = data.notes;
    this._createdAt = new Date(data.createdAt);
    this._updatedAt = new Date(data.updatedAt);
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
    const warnings: string[] = [];

    // RULE 1: Client name must be valid
    if (!ClientRules.validateClientName(params.name)) {
      errors.push('Client name must be between 1 and 100 characters');
    }

    // RULE 2: Check for duplicate names (matches orchestrator behavior)
    if (params.name && params.existingClients) {
      const { available, conflictingClient } = ClientRules.isClientNameAvailable(
        params.name,
        params.existingClients,
        undefined // New client, no existing ID
      );
      
      if (!available && conflictingClient) {
        errors.push(
          `A client named "${conflictingClient.name}" already exists. ` +
          `Client names must be unique (case-insensitive).`
        );
      }
    }

    // RULE 3: Email must be valid format (if provided)
    if (params.contactEmail && !ClientRules.validateClientEmail(params.contactEmail)) {
      errors.push('Contact email must be a valid email address');
    }

    // RULE 4: Phone must be valid format (if provided)
    if (params.contactPhone && !ClientRules.validateClientPhone(params.contactPhone)) {
      errors.push('Contact phone must contain only valid characters (digits, spaces, hyphens, parentheses, plus)');
    }

    if (errors.length > 0) {
      return { 
        success: false, 
        errors,
        warnings: warnings.length > 0 ? warnings : undefined
      };
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
      data: new Client(clientData),
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Create from database data
   * 
   * Use this when loading existing clients from the database.
   * Assumes data is already valid (was validated on creation).
   * 
   * @param data - Client data from database (snake_case)
   * @returns Client entity
   */
  static fromDatabase(data: ClientRow): Client {
    // Convert database format (snake_case) to entity format (camelCase)
    const clientData: ClientData = {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      status: data.status as ClientStatus,
      contactEmail: data.contact_email ?? undefined,
      contactPhone: data.contact_phone ?? undefined,
      billingAddress: data.billing_address ?? undefined,
      notes: data.notes ?? undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
    return new Client(clientData);
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
    if (params.name !== undefined) this._name = params.name.trim();
    if (params.status !== undefined) this._status = params.status;
    if (params.contactEmail !== undefined) this._contactEmail = params.contactEmail?.trim();
    if (params.contactPhone !== undefined) this._contactPhone = params.contactPhone?.trim();
    if (params.billingAddress !== undefined) this._billingAddress = params.billingAddress?.trim();
    if (params.notes !== undefined) this._notes = params.notes?.trim();
    this._updatedAt = new Date();

    return { success: true };
  }

  /**
   * Activate the client
   */
  activate(): void {
    this._status = 'active';
    this._updatedAt = new Date();
  }

  /**
   * Deactivate the client
   */
  deactivate(): void {
    this._status = 'inactive';
    this._updatedAt = new Date();
  }

  /**
   * Archive the client
   */
  archive(): void {
    this._status = 'archived';
    this._updatedAt = new Date();
  }

  // ============================================================================
  // QUERY METHODS - Read current state
  // ============================================================================

  /**
   * Check if client is active
   */
  isActive(): boolean {
    return this._status === 'active';
  }

  /**
   * Check if client is archived
   */
  isArchived(): boolean {
    return this._status === 'archived';
  }

  /**
   * Get client's display name
   */
  getDisplayName(): string {
    return this._name;
  }

  /**
   * Check if client has contact information
   */
  hasContactInfo(): boolean {
    return !!(this._contactEmail || this._contactPhone);
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
      id: this._id,
      name: this._name,
      status: this._status,
      contactEmail: this._contactEmail,
      contactPhone: this._contactPhone,
      billingAddress: this._billingAddress,
      notes: this._notes,
      userId: this._userId,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt
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
