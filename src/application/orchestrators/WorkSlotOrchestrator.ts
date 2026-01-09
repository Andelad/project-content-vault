/**
 * WorkSlot Orchestrator
 * 
 * Coordinates WorkSlot workflows including:
 * - Template slot management (weekly pattern stored in settings)
 * - Exception management (date-specific overrides in database)
 * - Entity validation for all WorkSlot operations
 * 
 * ARCHITECTURE:
 * - Template Slots: JSON in settings.weekly_work_hours (baseline weekly pattern)
 * - Exceptions: work_slot_exceptions table (date-specific overrides)
 * 
 * Phase 1: Template slot management with entity validation
 * Phase 2: Exception handling (currently stubbed - broken code removed)
 * 
 * ✅ Uses WorkSlot entity for validation
 * ✅ Coordinates with SettingsContext for template persistence
 * ✅ Provides clean API for UI components
 */

import { WorkSlot as WorkSlotEntity } from '@/domain/entities/WorkSlot';
import { WorkSlot, Settings } from '@/shared/types/core';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/** Type for the settings update function injected from SettingsContext */
type UpdateSettingsFn = (updates: Partial<Settings>) => Promise<void>;

interface SaveTemplateSlotParams {
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
}

interface UpdateTemplateSlotParams {
  dayOfWeek: DayOfWeek;
  slotId: string;
  startTime?: string;
  endTime?: string;
}

interface DeleteTemplateSlotParams {
  dayOfWeek: DayOfWeek;
  slotId: string;
}

export interface WorkSlotOrchestrationResult {
  success: boolean;
  slot?: WorkSlot;
  error?: string;
  errors?: string[];
}

/**
 * WorkSlot Orchestrator
 * 
 * Handles both template slots and exceptions (Phase 2).
 * Validates all operations using WorkSlot entity.
 */
export class WorkSlotOrchestrator {
  /**
   * Save a new template slot to weekly work hours
   * 
   * Validates using WorkSlot entity, then persists to settings.
   * Template slots define the baseline weekly pattern.
   * 
   * @param params - Slot creation parameters
   * @param updateSettings - Function to update settings (injected from context)
   * @param currentSettings - Current settings object
   * @returns Result with new slot or validation errors
   */
  static async saveTemplateSlot(
    params: SaveTemplateSlotParams,
    updateSettings: UpdateSettingsFn,
    currentSettings: Settings | null
  ): Promise<WorkSlotOrchestrationResult> {
    try {
      // 1. Validate with entity
      const entityResult = WorkSlotEntity.create({
        startTime: params.startTime,
        endTime: params.endTime
      });

      if (!entityResult.success) {
        return {
          success: false,
          errors: entityResult.errors
        };
      }

      // 2. Convert to plain data
      const slotData = entityResult.data!.toData();

      // 3. Create new slot with generated ID
      const newSlot: WorkSlot = {
        id: Date.now().toString(),
        startTime: slotData.startTime,
        endTime: slotData.endTime,
        duration: slotData.duration
      };

      // 4. Update settings
      const weeklyWorkHours = currentSettings?.weeklyWorkHours || {} as Settings['weeklyWorkHours'];
      const currentDaySlots = weeklyWorkHours[params.dayOfWeek] || [];

      await updateSettings({
        weeklyWorkHours: {
          ...weeklyWorkHours,
          [params.dayOfWeek]: [...currentDaySlots, newSlot]
        }
      });

      return {
        success: true,
        slot: newSlot
      };

    } catch (error) {
      ErrorHandlingService.handle(error, {
        source: 'WorkSlotOrchestrator',
        action: 'saveTemplateSlot'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save work slot'
      };
    }
  }

  /**
   * Update an existing template slot
   * 
   * Validates using WorkSlot entity, then updates in settings.
   * 
   * @param params - Slot update parameters
   * @param updateSettings - Function to update settings
   * @param currentSettings - Current settings object
   * @returns Result with updated slot or validation errors
   */
  static async updateTemplateSlot(
    params: UpdateTemplateSlotParams,
    updateSettings: UpdateSettingsFn,
    currentSettings: Settings | null
  ): Promise<WorkSlotOrchestrationResult> {
    try {
      if (!currentSettings?.weeklyWorkHours) {
        return {
          success: false,
          error: 'No work hours configured'
        };
      }

      const weeklyWorkHours = currentSettings.weeklyWorkHours;
      const daySlots = weeklyWorkHours[params.dayOfWeek] || [];
      
      // Find existing slot
      const existingSlot = daySlots.find((slot: WorkSlot) => slot.id === params.slotId);
      if (!existingSlot) {
        return {
          success: false,
          error: 'Work slot not found'
        };
      }

      // Build updated slot data
      const updatedStartTime = params.startTime || existingSlot.startTime;
      const updatedEndTime = params.endTime || existingSlot.endTime;

      // Validate with entity
      const entityResult = WorkSlotEntity.create({
        startTime: updatedStartTime,
        endTime: updatedEndTime
      });

      if (!entityResult.success) {
        return {
          success: false,
          errors: entityResult.errors
        };
      }

      const validatedData = entityResult.data!.toData();

      // Update the slot
      const updatedSlots = daySlots.map((slot: WorkSlot) => {
        if (slot.id === params.slotId) {
          return {
            ...slot,
            startTime: validatedData.startTime,
            endTime: validatedData.endTime,
            duration: validatedData.duration
          };
        }
        return slot;
      });

      await updateSettings({
        weeklyWorkHours: {
          ...weeklyWorkHours,
          [params.dayOfWeek]: updatedSlots
        }
      });

      return {
        success: true,
        slot: updatedSlots.find((s: WorkSlot) => s.id === params.slotId)
      };

    } catch (error) {
      ErrorHandlingService.handle(error, {
        source: 'WorkSlotOrchestrator',
        action: 'updateTemplateSlot'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update work slot'
      };
    }
  }

  /**
   * Delete a template slot
   * 
   * Removes slot from settings.weekly_work_hours.
   * 
   * @param params - Slot deletion parameters
   * @param updateSettings - Function to update settings
   * @param currentSettings - Current settings object
   * @returns Result indicating success or failure
   */
  static async deleteTemplateSlot(
    params: DeleteTemplateSlotParams,
    updateSettings: UpdateSettingsFn,
    currentSettings: Settings | null
  ): Promise<WorkSlotOrchestrationResult> {
    try {
      if (!currentSettings?.weeklyWorkHours) {
        return {
          success: false,
          error: 'No work hours configured'
        };
      }

      const weeklyWorkHours = currentSettings.weeklyWorkHours;
      const daySlots = weeklyWorkHours[params.dayOfWeek] || [];
      
      const updatedSlots = daySlots.filter((slot: WorkSlot) => slot.id !== params.slotId);

      await updateSettings({
        weeklyWorkHours: {
          ...weeklyWorkHours,
          [params.dayOfWeek]: updatedSlots
        }
      });

      return {
        success: true
      };

    } catch (error) {
      ErrorHandlingService.handle(error, {
        source: 'WorkSlotOrchestrator',
        action: 'deleteTemplateSlot'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete work slot'
      };
    }
  }

  // ============================================================================
  // EXCEPTION MANAGEMENT - Phase 2 (Stubbed)
  // ============================================================================

  /**
   * TODO Phase 2: Create work slot exception for specific date
   * 
   * Will validate using WorkSlot entity and save to work_slot_exceptions table.
   * Exceptions override template slots for specific dates.
   */
  static async createException(
    // TODO: Define params when implementing
  ): Promise<WorkSlotOrchestrationResult> {
    throw new Error('Work slot exceptions not yet implemented - Phase 2 feature');
  }

  /**
   * TODO Phase 2: Update work slot exception
   */
  static async updateException(
    // TODO: Define params when implementing
  ): Promise<WorkSlotOrchestrationResult> {
    throw new Error('Work slot exceptions not yet implemented - Phase 2 feature');
  }

  /**
   * TODO Phase 2: Delete work slot exception
   */
  static async deleteException(
    // TODO: Define params when implementing
  ): Promise<WorkSlotOrchestrationResult> {
    throw new Error('Work slot exceptions not yet implemented - Phase 2 feature');
  }
}
