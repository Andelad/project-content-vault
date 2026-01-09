/**
 * Profile Orchestrator
 * 
 * Coordinates user profile management workflows.
 * Handles profile updates, avatar uploads, email changes, and account deletion.
 * 
 * ✅ Centralizes all profile-related database operations
 * ✅ Handles file uploads to storage buckets
 * ✅ Coordinates multi-step workflows (upload → update → cleanup)
 * ✅ Provides clean API for ProfileView component
 */

import { supabase } from '@/infrastructure/database/client';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';

export interface Profile {
  user_id?: string;
  display_name?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateProfileInput {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
}

export interface UploadAvatarInput {
  user_id: string;
  file: File;
  currentAvatarUrl?: string;
  defaultDisplayName?: string;
}

export interface UpdateEmailInput {
  newEmail: string;
}

export interface ExportDataResult {
  profile: Profile | null;
  projects: unknown[];
  calendarEvents: unknown[];
  settings: unknown;
  exportDate: string;
}

export interface OperationResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AvatarUploadResult extends OperationResult {
  data?: {
    publicUrl: string;
  };
}

/**
 * Profile Orchestrator
 * Handles all user profile-related workflows
 */
export class ProfileOrchestrator {

  /**
   * Fetch user profile by user ID
   */
  static async fetchProfile(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        ErrorHandlingService.handle(error, { 
          source: 'ProfileOrchestrator', 
          action: 'fetchProfile' 
        });
        return null;
      }
      
      return data;
    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'ProfileOrchestrator', 
        action: 'fetchProfile' 
      });
      return null;
    }
  }

  /**
   * Update user profile (display name and/or avatar URL)
   */
  static async updateProfile(input: UpdateProfileInput): Promise<OperationResult> {
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: input.user_id,
          display_name: input.display_name,
          avatar_url: input.avatar_url
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        ErrorHandlingService.handle(error, { 
          source: 'ProfileOrchestrator', 
          action: 'updateProfile' 
        });
        return {
          success: false,
          error: error.message
        };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      ErrorHandlingService.handle(error, { 
        source: 'ProfileOrchestrator', 
        action: 'updateProfile' 
      });
      return {
        success: false,
        error: message
      };
    }
  }

  /**
   * Upload avatar image and update profile
   * Multi-step workflow:
   * 1. Delete existing avatar (if exists)
   * 2. Upload new avatar to storage
   * 3. Update profile with new avatar URL
   */
  static async uploadAvatar(input: UploadAvatarInput): Promise<AvatarUploadResult> {
    try {
      // Create unique filename with user ID
      const fileExt = input.file.name.split('.').pop();
      const fileName = `${input.user_id}/avatar.${fileExt}`;

      // Step 1: Delete existing avatar if it exists
      if (input.currentAvatarUrl) {
        try {
          const existingPath = input.currentAvatarUrl.split('/').slice(-2).join('/');
          await supabase.storage
            .from('avatars')
            .remove([existingPath]);
        } catch (deleteError) {
          // Log but don't fail - old avatar might not exist
          ErrorHandlingService.handle(deleteError, { 
            source: 'ProfileOrchestrator', 
            action: 'uploadAvatar:deleteOld' 
          });
        }
      }

      // Step 2: Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, input.file, {
          upsert: true
        });

      if (uploadError) {
        return {
          success: false,
          error: uploadError.message
        };
      }

      // Step 3: Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Step 4: Update profile with new avatar URL
      const updateResult = await this.updateProfile({
        user_id: input.user_id,
        display_name: input.defaultDisplayName,
        avatar_url: data.publicUrl
      });

      if (!updateResult.success) {
        return {
          success: false,
          error: updateResult.error
        };
      }

      return {
        success: true,
        data: {
          publicUrl: data.publicUrl
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload avatar';
      ErrorHandlingService.handle(error, { 
        source: 'ProfileOrchestrator', 
        action: 'uploadAvatar' 
      });
      return {
        success: false,
        error: message
      };
    }
  }

  /**
   * Update user email address via Supabase Auth
   * Note: This triggers a confirmation email
   */
  static async updateEmail(input: UpdateEmailInput): Promise<OperationResult> {
    try {
      const { error } = await supabase.auth.updateUser({
        email: input.newEmail
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update email';
      return {
        success: false,
        error: message
      };
    }
  }

  /**
   * Update user password via Supabase Auth
   */
  static async updatePassword(newPassword: string): Promise<OperationResult> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update password';
      return {
        success: false,
        error: message
      };
    }
  }

  /**
   * Export all user data (profile, projects, events, settings)
   * for data portability / GDPR compliance
   */
  static async exportUserData(
    userId: string, 
    profile: Profile | null,
    settings: unknown
  ): Promise<ExportDataResult | null> {
    try {
      // Fetch all user data from database
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId);

      const { data: calendarEvents, error: eventsError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', userId);

      if (projectsError || eventsError) {
        ErrorHandlingService.handle(
          projectsError || eventsError, 
          { source: 'ProfileOrchestrator', action: 'exportUserData' }
        );
        return null;
      }

      // Create export object
      return {
        profile,
        projects: projects || [],
        calendarEvents: calendarEvents || [],
        settings,
        exportDate: new Date().toISOString()
      };
    } catch (error) {
      ErrorHandlingService.handle(error, { 
        source: 'ProfileOrchestrator', 
        action: 'exportUserData' 
      });
      return null;
    }
  }

  /**
   * Delete user account
   * WARNING: This is a destructive operation
   * 
   * Note: Actual user deletion happens via Supabase Edge Function
   * Requires active session with access token
   */
  static async deleteAccount(): Promise<OperationResult> {
    try {
      // Get current session for authorization
      const { data: session } = await supabase.auth.getSession();
      
      if (!session?.session?.access_token) {
        return {
          success: false,
          error: 'No active session'
        };
      }

      // Call edge function to delete account (requires service role key)
      const { data, error } = await supabase.functions.invoke('delete-account', {
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (error) {
        ErrorHandlingService.handle(error, { 
          source: 'ProfileOrchestrator', 
          action: 'deleteAccount' 
        });
        return {
          success: false,
          error: error.message
        };
      }

      if (!data?.success) {
        const errorMsg = data?.error || 'Failed to delete account';
        return {
          success: false,
          error: errorMsg
        };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete account';
      ErrorHandlingService.handle(error, { 
        source: 'ProfileOrchestrator', 
        action: 'deleteAccount' 
      });
      return {
        success: false,
        error: message
      };
    }
  }
}
