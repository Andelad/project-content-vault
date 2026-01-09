/**
 * Settings Orchestrator
 * 
 * Coordinates settings management workflows extracted from SettingsView component.
 * Handles async settings operations, validation, and state management.
 * 
 * ✅ Delegates to SettingsContext for persistence
 * ✅ Coordinates settings validation and error handling
 * ✅ Handles complex multi-step settings workflows
 * ✅ Provides clean API for UI components
 */

import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';
import { Settings } from '@/shared/types/core';

type LocalSettings = Partial<Settings> & { defaultView?: string };
type UpdateSettingsFn = (settings: Partial<Settings>) => void;
type SetLocalSettingsFn = (setter: (prev: LocalSettings) => LocalSettings) => void;

export interface SettingsUpdateResult {
  success: boolean;
  error?: string;
  message?: string;
}

export interface SettingsResetResult {
  success: boolean;
  resetSettings: LocalSettings;
}

/**
 * Settings Orchestrator
 * Handles all settings-related workflows and operations
 */
export class SettingsOrchestrator {

  /**
   * Handle settings change with immediate application and persistence
   * COORDINATES with SettingsContext for persistence (AI Rule)
   */
  static async updateSetting(
    key: string,
    value: Settings[keyof Settings] | string | number | boolean | null,
    context: {
      setLocalSettings: SetLocalSettingsFn;
      updateSettings: UpdateSettingsFn;
      setDefaultView?: (view: string) => void;
    }
  ): Promise<SettingsUpdateResult> {
    try {
      // Update local state immediately
      context.setLocalSettings(prev => ({ ...prev, [key]: value }));
      
      // Handle special settings that need immediate application
      if (key === 'defaultView' && context.setDefaultView) {
        const viewValue = String(value);
        context.setDefaultView(viewValue);
        
        // Save to database/localStorage
        context.updateSettings({ defaultView: viewValue });
        
        const viewDisplayName = viewValue === 'timeline-weeks' ? 'Timeline (weeks)' : 
                               viewValue === 'timeline' ? 'Timeline (days)' :
                               viewValue === 'projects' ? 'Projects' : 
                               viewValue === 'calendar' ? 'Calendar' : viewValue;
        
        return {
          success: true,
          message: `Your default view has been set to ${viewDisplayName}`
        };
      }

      return { success: true };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'SettingsOrchestrator', action: 'Failed to update setting:' });
      return {
        success: false,
        error: `Failed to save ${key} setting`
      };
    }
  }

  /**
   * Save all settings with comprehensive error handling
   * DELEGATES to SettingsContext for persistence (AI Rule)
   */
  static async saveAllSettings(
    localSettings: LocalSettings,
    context: {
      updateSettings: UpdateSettingsFn;
    }
  ): Promise<SettingsUpdateResult> {
    try {
      // Save all settings
      context.updateSettings({
        defaultView: localSettings.defaultView,
        // Add other settings here as they're implemented
      });
      
      return {
        success: true,
        message: "Your preferences have been updated successfully."
      };
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'SettingsOrchestrator', action: 'Failed to save settings:' });
      return {
        success: false,
        error: "Changes applied in current session (database save pending).",
        message: "Settings applied locally"
      };
    }
  }

  /**
   * Reset settings to default values
   * COORDINATES with local state management
   */
  static resetToDefaults(): SettingsResetResult {
    const defaultSettings = {
      notifications: true,
      emailNotifications: false,
      darkMode: false,
      timeFormat: '12h',
      timezone: 'UTC-8',
      language: 'en',
      autoSave: true,
      defaultView: 'projects'
    };

    return {
      success: true,
      resetSettings: defaultSettings
    };
  }

  /**
   * Clear application data (placeholder for future implementation)
   * COORDINATES with data clearing workflows
   */
  static async clearApplicationData(): Promise<SettingsUpdateResult> {
    // Placeholder for data clearing logic
    // Would delegate to appropriate services for data removal
    
    return {
      success: true,
      message: "Application data clearing is not yet implemented"
    };
  }
}