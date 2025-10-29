/**
 * Availability Circle Calculations
 * Pure business logic for availability circle sizing in timeline views
 * 
 * Migrated from legacy/timeline/AvailabilityCircleSizingService
 * Enhanced with better type safety and documentation
 */

export interface AvailabilityCircleSizing {
  outerDiameter: number;
  innerDiameter: number;
  pixelsPerHour: number;
}

/**
 * Calculate availability circle sizing based on hours and timeline view mode
 * 
 * Business Rules:
 * - Day view: 8 hours = 40px circle
 * - Week view: 40 hours (5x8) = same 40px circle (requires 5x more hours)
 * - Consistent 5px per scaled hour for both views
 * - Main circle: first 8 hours, Inner circle: up to 7 additional hours
 * 
 * @param targetHours - Total hours to represent visually
 * @param mode - Timeline view mode ('days' or 'weeks')
 * @returns Circle sizing information with outer and inner diameters
 */
export function calculateAvailabilityCircleSize(
  targetHours: number,
  mode: 'days' | 'weeks'
): AvailabilityCircleSizing {
  if (targetHours < 0) {
    throw new Error('Target hours cannot be negative');
  }

  // Scale hours based on view mode
  // In weeks view, divide hours by 5 so it takes 5x more hours to reach same visual size
  const scaledHours = mode === 'weeks' ? targetHours / 5 : targetHours;
  
  // Split scaled hours: first 8 hours (main circle), then up to 7 more hours (inner circle)
  const mainHours = Math.min(scaledHours, 8);
  const extraHours = Math.max(0, Math.min(scaledHours - 8, 7));
  
  // Convert to pixels (consistent 5px = 1 scaled hour for both views)
  const pixelsPerHour = 5;
  const outerDiameter = mainHours * pixelsPerHour;
  const innerDiameter = extraHours * pixelsPerHour;
  
  return {
    outerDiameter,
    innerDiameter,
    pixelsPerHour
  };
}

/**
 * Get minimum circle dimensions to ensure visibility
 * Ensures circles have minimum visual presence even for small hour values
 * 
 * @param diameter - Calculated diameter in pixels
 * @returns Minimum diameter to use for rendering (10px minimum for circles, 0 if input is 0)
 */
export function getMinimumCircleDimensions(diameter: number): number {
  if (diameter < 0) {
    throw new Error('Diameter cannot be negative');
  }
  
  return diameter > 0 ? Math.max(diameter, 10) : 0; // Scaled from 11px to 10px for 5px/hour scaling
}

/**
 * Calculate total visual area for availability comparison
 * Useful for comparing relative availability between different periods
 * 
 * @param sizing - Circle sizing information
 * @returns Total visual area in square pixels
 */
export function calculateAvailabilityVisualArea(sizing: AvailabilityCircleSizing): number {
  const outerRadius = sizing.outerDiameter / 2;
  const innerRadius = sizing.innerDiameter / 2;
  
  // π × (outer² + inner²) for combined circle areas
  return Math.PI * (outerRadius * outerRadius + innerRadius * innerRadius);
}
