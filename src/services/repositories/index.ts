/**
 * Repository Module Index
 * 
 * Exports for active repository implementations.
 * 
 * Phase 2 Simplification:
 * - Most data access now happens via direct Supabase calls in orchestrators
 * - Only complex state management repositories remain
 * 
 * @module repositories
 */

// Active repository: Complex state management with localStorage caching and realtime sync
export { timeTrackingRepository } from './timeTrackingRepository';
