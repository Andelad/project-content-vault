/**
 * Label Business Rules
 *
 * Single source of truth for all label-related business logic.
 * Defines validation, constraints, and business rules for label entities.
 *
 * This is the domain layer - pure business logic with no external dependencies.
 *
 * @see CLIENT_GROUP_LABEL_TERMINOLOGY.md for complete label documentation
 */
import type { Label, Project } from '@/types/core';
// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
export interface LabelValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
// ============================================================================
// LABEL BUSINESS RULES
// ============================================================================
/**
 * Label Business Rules
 *
 * Centralized location for all label-related business logic.
 */
export class LabelRules {
  // ==========================================================================
  // RULE 1: LABEL NAME VALIDATION
  // ==========================================================================
  /**
   * RULE 1: Label name must be valid
   *
   * Business Logic: Label names must be non-empty, reasonable length, and usable for tagging
   *
   * @param name - The label name to validate
   * @returns true if name is valid, false otherwise
   */
  static validateLabelName(name: string): boolean {
    const trimmed = name.trim();
    return trimmed.length > 0 && trimmed.length <= 30;
  }
  // ==========================================================================
  // RULE 2: LABEL NAME NORMALIZATION
  // ==========================================================================
  /**
   * RULE 2: Normalize label name for consistency
   *
   * Business Logic: Labels should be normalized for comparison and display
   *
   * @param name - The label name to normalize
   * @returns Normalized label name
   */
  static normalizeLabelName(name: string): string {
    return name.trim().toLowerCase();
  }
  /**
   * RULE 3: Check if two label names are equivalent
   *
   * Business Logic: Case-insensitive comparison for duplicate detection
   *
   * @param name1 - First label name
   * @param name2 - Second label name
   * @returns true if names are equivalent
   */
  static areLabelNamesEquivalent(name1: string, name2: string): boolean {
    return this.normalizeLabelName(name1) === this.normalizeLabelName(name2);
  }
  // ==========================================================================
  // RULE 4: LABEL COLOR VALIDATION
  // ==========================================================================
  /**
   * RULE 4: Label color must be valid hex color (if provided)
   *
   * Business Logic: Colors should be valid hex codes for consistent display
   *
   * @param color - The color to validate
   * @returns true if color is valid hex or empty, false otherwise
   */
  static validateLabelColor(color?: string): boolean {
    if (!color || color.trim() === '') return true; // Optional field
    // Check for valid hex color format (#RGB, #RRGGBB, #RRGGBBAA)
    const hexRegex = /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;
    return hexRegex.test(color.trim());
  }
  // ==========================================================================
  // RULE 5: LABEL DELETION CONSTRAINTS
  // ==========================================================================
  /**
   * RULE 5: Labels can always be deleted
   *
   * Business Logic: Labels are flexible tags, can be safely removed
   * Relationships will be cascade deleted
   *
   * @param labelId - The label to check
   * @returns true (labels can always be deleted)
   */
  static canDeleteLabel(labelId: string): boolean {
    return true;
  }
  // ==========================================================================
  // VALIDATION RULES - COMPREHENSIVE CHECKS
  // ==========================================================================
  /**
   * Validate complete label data
   *
   * Combines all label validation rules
   *
   * @param label - The label to validate
   * @returns Detailed validation result
   */
  static validateLabel(label: Partial<Label>): LabelValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    // Name validation
    if (!label.name || !this.validateLabelName(label.name)) {
      errors.push('Label name is required and must be 1-30 characters');
    }
    // Color validation
    if (label.color && !this.validateLabelColor(label.color)) {
      errors.push('Label color must be a valid hex color (e.g., #FF0000)');
    }
    // Check for potentially confusing names
    if (label.name) {
      const normalized = this.normalizeLabelName(label.name);
      if (normalized.includes(' ') && normalized.split(' ').length > 3) {
        warnings.push('Label names with many words may be hard to read');
      }
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
   * Get label display name
   *
   * @param label - The label
   * @returns Display name for UI
   */
  static getLabelDisplayName(label: Label): string {
    return label.name;
  }
  /**
   * Get label display color
   *
   * @param label - The label
   * @returns Color for UI display
   */
  static getLabelDisplayColor(label: Label): string {
    return label.color || '#6b7280'; // Default gray if no color
  }
  /**
   * Sort labels for consistent display
   *
   * @param labels - Labels to sort
   * @returns Sorted labels
   */
  static sortLabels(labels: Label[]): Label[] {
    return [...labels].sort((a, b) =>
      this.normalizeLabelName(a.name).localeCompare(this.normalizeLabelName(b.name))
    );
  }
  /**
   * Filter labels by search term
   *
   * @param labels - Labels to filter
   * @param searchTerm - Term to search for
   * @returns Filtered labels
   */
  static filterLabels(labels: Label[], searchTerm: string): Label[] {
    if (!searchTerm.trim()) return labels;
    const normalizedSearch = this.normalizeLabelName(searchTerm);
    return labels.filter(label =>
      this.normalizeLabelName(label.name).includes(normalizedSearch)
    );
  }
  // ==========================================================================
  // PERFORMANCE MONITORING
  // ==========================================================================
  /**
   * PERFORMANCE: Monitor label query performance
   * Track how many labels are being queried and processed
   */
  private static performanceMetrics = {
    queriesExecuted: 0,
    averageLabelsPerQuery: 0,
    slowQueries: 0,
    lastQueryTime: 0
  };
  /**
   * PERFORMANCE: Record label query metrics
   */
  static recordLabelQuery(labels: Label[], queryTimeMs: number) {
    this.performanceMetrics.queriesExecuted++;
    this.performanceMetrics.averageLabelsPerQuery =
      (this.performanceMetrics.averageLabelsPerQuery + labels.length) / 2;
    this.performanceMetrics.lastQueryTime = queryTimeMs;
    if (queryTimeMs > 100) { // Slow query threshold
      this.performanceMetrics.slowQueries++;
      console.warn(`⚠️ Slow label query: ${queryTimeMs}ms for ${labels.length} labels`);
    }
    // Log performance stats every 100 queries
    if (this.performanceMetrics.queriesExecuted % 100 === 0) {
      console.info('Label query performance', {
        queriesExecuted: this.performanceMetrics.queriesExecuted,
        averageLabelsPerQuery: this.performanceMetrics.averageLabelsPerQuery,
        slowQueries: this.performanceMetrics.slowQueries,
        lastQueryTime: this.performanceMetrics.lastQueryTime
      });
    }
  }
  /**
   * PERFORMANCE: Get current performance metrics
   */
  static getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }
  /**
   * Get suggested labels based on existing usage
   *
   * @param allLabels - All available labels
   * @param projectLabels - Labels currently on a project
   * @returns Suggested labels (popular ones not already used)
   */
  static getSuggestedLabels(allLabels: Label[], projectLabels: Label[]): Label[] {
    const usedLabelIds = new Set(projectLabels.map(l => l.id));
    // For now, just return unused labels sorted by name
    // Could be enhanced with usage frequency analysis
    return this.sortLabels(
      allLabels.filter(label => !usedLabelIds.has(label.id))
    );
  }
}
