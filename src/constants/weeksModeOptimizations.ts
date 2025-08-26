/**
 * Performance optimization suggestions for Weeks Timeline Mode
 * 
 * Current Issues:
 * - 7x more DOM nodes per project (day segments within weeks)
 * - Complex pixel positioning calculations 
 * - Performance cliff at 25+ projects
 * 
 * Recommendations:
 */

// Option 1: Simplified Week Rendering (Immediate)
export const WEEKS_MODE_OPTIMIZATIONS = {
  // Reduce day-level granularity in weeks mode
  RENDER_WEEKS_AS_SINGLE_UNITS: true,
  
  // Throttle drag updates more aggressively in weeks mode  
  WEEKS_DRAG_THROTTLE_MS: 100, // vs 50ms for days mode
  
  // Reduce viewport in weeks mode for better performance
  MAX_WEEKS_VIEWPORT: 12, // ~3 months max
  
  // Simplify continuous project calculations
  WEEKS_CONTINUOUS_PROJECT_OPTIMIZATION: true
};

// Option 2: Virtual Scrolling (Future Enhancement)
export const VIRTUAL_SCROLLING_CONFIG = {
  ENABLE_VIRTUAL_TIMELINE: false, // Feature flag
  RENDER_BUFFER_WEEKS: 2, // Render 2 weeks before/after visible area
  LAZY_LOAD_THRESHOLD: 20 // Enable when > 20 projects
};

// Option 3: Progressive Enhancement
export const PROGRESSIVE_ENHANCEMENT = {
  // Automatically switch to simplified rendering with many projects
  AUTO_SIMPLIFY_THRESHOLD: 25,
  
  // Show performance warning
  PERFORMANCE_WARNING_THRESHOLD: 20,
  
  // Suggest days mode for heavy usage
  SUGGEST_DAYS_MODE_THRESHOLD: 30
};
