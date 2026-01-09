/**
 * Client Business Rules
 *
 * Single source of truth for all client-related business logic.
 * Defines validation, constraints, and business rules for client entities.
 *
 * This is the domain layer - pure business logic with no external dependencies.
 *
 * @see CLIENT_GROUP_LABEL_TERMINOLOGY.md for complete client documentation
 */

import type { Client, Project } from '@/shared/types/core';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ClientValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// CLIENT BUSINESS RULES
// ============================================================================

/**
 * Client Business Rules
 *
 * Centralized location for all client-related business logic.
 */
export class ClientRules {

  // ==========================================================================
  // RULE 1: CLIENT NAME VALIDATION
  // ==========================================================================

  /**
   * RULE 1: Client name must be valid
   *
   * Business Logic: Client names must be non-empty and reasonable length
   *
   * @param name - The client name to validate
   * @returns true if name is valid, false otherwise
   */
  static validateClientName(name: string): boolean {
    const trimmed = name.trim();
    return trimmed.length > 0 && trimmed.length <= 100;
  }

  // ==========================================================================
  // RULE 1B: CLIENT NAME UNIQUENESS (CASE-INSENSITIVE)
  // ==========================================================================

  /**
   * RULE 1B: Check for duplicate client names (case-insensitive)
   *
   * Business Logic: Client names must be unique per user, ignoring case
   * Reference: Business Logic Invariant 6
   *
   * @param name - The client name to check
   * @param existingClients - All existing clients for this user
   * @param excludeClientId - Optional client ID to exclude (for updates)
   * @returns Object with availability status and conflicting client if found
   */
  static isClientNameAvailable(
    name: string,
    existingClients: Client[],
    excludeClientId?: string
  ): { available: boolean; conflictingClient?: Client } {
    const normalizedName = name.trim().toLowerCase();
    
    const conflict = existingClients.find(client => 
      client.name.toLowerCase() === normalizedName &&
      client.id !== excludeClientId
    );
    
    return {
      available: !conflict,
      conflictingClient: conflict
    };
  }

  // ==========================================================================
  // RULE 2: CLIENT CONTACT VALIDATION
  // ==========================================================================

  /**
   * RULE 2: Client email must be valid format (if provided)
   *
   * Business Logic: Email should follow basic email format
   *
   * @param email - The email to validate
   * @returns true if email is valid or empty, false otherwise
   */
  static validateClientEmail(email?: string): boolean {
    if (!email || email.trim() === '') return true; // Optional field

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * RULE 3: Client phone must be valid format (if provided)
   *
   * Business Logic: Phone should contain only valid characters
   *
   * @param phone - The phone to validate
   * @returns true if phone is valid or empty, false otherwise
   */
  static validateClientPhone(phone?: string): boolean {
    if (!phone || phone.trim() === '') return true; // Optional field

  // Allow digits, spaces, hyphens, parentheses, plus signs
  const phoneRegex = /^[\d\s()+-]+$/;
    return phoneRegex.test(phone.trim());
  }

  // ==========================================================================
  // RULE 4: CLIENT DELETION CONSTRAINTS
  // ==========================================================================

  /**
   * RULE 4: Client can only be deleted if it has no projects
   *
   * Business Logic: Prevent deletion of clients with active projects
   *
   * @param clientId - The client to check
   * @param projects - All projects
   * @returns true if client can be deleted, false otherwise
   */
  static canDeleteClient(clientId: string, projects: Project[]): boolean {
    const clientProjects = projects.filter(p => p.clientId === clientId);
    return clientProjects.length === 0;
  }

  // ==========================================================================
  // VALIDATION RULES - COMPREHENSIVE CHECKS
  // ==========================================================================

  /**
   * Validate complete client data
   *
   * Combines all client validation rules
   *
   * @param client - The client to validate
   * @returns Detailed validation result
   */
  static validateClient(
    client: Partial<Client>,
    existingClients: Client[] = [],
    isUpdate: boolean = false
  ): ClientValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Name validation
    if (!client.name || !this.validateClientName(client.name)) {
      errors.push('Client name is required and must be 1-100 characters');
    } else {
      // Check for duplicate names (case-insensitive)
      const { available, conflictingClient } = this.isClientNameAvailable(
        client.name,
        existingClients,
        isUpdate ? client.id : undefined
      );
      
      if (!available && conflictingClient) {
        errors.push(
          `A client named "${conflictingClient.name}" already exists. ` +
          `Client names must be unique (case-insensitive).`
        );
      }
    }

    // Email validation
    if (client.contactEmail && !this.validateClientEmail(client.contactEmail)) {
      errors.push('Client email must be a valid email address');
    }

    // Phone validation
    if (client.contactPhone && !this.validateClientPhone(client.contactPhone)) {
      errors.push('Client phone contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // BUSINESS LOGIC HELPERS
  // ==========================================================================

  /**
   * Get client display name
   *
   * @param client - The client
   * @returns Display name for UI
   */
  static getClientDisplayName(client: Client): string {
    return client.name;
  }

  /**
   * Check if client has contact information
   *
   * @param client - The client
   * @returns true if client has any contact info
   */
  static hasContactInfo(client: Client): boolean {
    return !!(client.contactEmail || client.contactPhone || client.billingAddress);
  }

  /**
   * Get client summary for listings
   *
   * @param client - The client
   * @param projectCount - Number of projects for this client
   * @returns Summary string
   */
  static getClientSummary(client: Client, projectCount: number): string {
    const contactInfo = this.hasContactInfo(client);
    const parts = [];

    if (projectCount > 0) {
      parts.push(`${projectCount} project${projectCount === 1 ? '' : 's'}`);
    }

    if (contactInfo) {
      parts.push('contact info available');
    }

    return parts.length > 0 ? parts.join(', ') : 'No projects';
  }
}
