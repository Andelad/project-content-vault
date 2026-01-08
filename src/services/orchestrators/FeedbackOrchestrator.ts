/**
 * Feedback Orchestrator
 * 
 * Orchestrates feedback submission workflow including:
 * - Creating feedback records
 * - Uploading attachments to storage
 * - Generating signed URLs for attachments
 * - Saving attachment metadata
 * 
 * This fixes the architectural bypass where FeedbackModal.tsx was directly
 * calling supabase, breaking the three-layer architecture.
 * 
 * ✅ Pure orchestrator - coordinates workflow only
 * ✅ No business logic (validation would live in domain/rules/feedback/)
 * ✅ Provides clean API for UI components
 */

import { supabase } from '@/integrations/supabase/client';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

export interface FeedbackSubmission {
  usageContext: string;
  feedbackType: string;
  feedbackText: string;
  attachments: File[];
}

export interface FeedbackSubmissionResult {
  success: boolean;
  error?: string;
  feedbackId?: string;
}

/**
 * Feedback Orchestrator
 * Handles the complete workflow of submitting user feedback
 */
export class FeedbackOrchestrator {
  
  /**
   * Submit feedback with optional attachments
   * 
   * Workflow:
   * 1. Get current user
   * 2. Insert feedback record
   * 3. Upload each attachment to storage
   * 4. Generate signed URL for each attachment
   * 5. Save attachment metadata
   * 
   * @param submission - Feedback submission data
   * @returns Result indicating success/failure
   */
  static async submitFeedback(
    submission: FeedbackSubmission
  ): Promise<FeedbackSubmissionResult> {
    try {
      // Step 1: Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw new Error(`Failed to get user: ${userError.message}`);
      }

      // Step 2: Insert feedback record
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback')
        .insert({
          user_id: user?.id,
          usage_context: submission.usageContext,
          feedback_type: submission.feedbackType,
          feedback_text: submission.feedbackText,
          user_email: user?.email,
          user_agent: navigator.userAgent,
          url: window.location.href
        })
        .select()
        .single();

      if (feedbackError) {
        throw new Error(`Failed to insert feedback: ${feedbackError.message}`);
      }

      if (!feedbackData) {
        throw new Error('No feedback data returned after insert');
      }

      // Step 3-5: Process attachments if any
      if (submission.attachments.length > 0) {
        await this.uploadAttachments(
          feedbackData.id,
          user?.id || 'anonymous',
          submission.attachments
        );
      }

      return {
        success: true,
        feedbackId: feedbackData.id
      };
    } catch (error) {
      ErrorHandlingService.handle(error, {
        source: 'FeedbackOrchestrator',
        action: 'submitFeedback'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Upload attachments and save metadata
   * 
   * Private helper method for attachment processing workflow
   */
  private static async uploadAttachments(
    feedbackId: string,
    userId: string,
    attachments: File[]
  ): Promise<void> {
    for (const file of attachments) {
      const filePath = `${userId}/${feedbackId}/${file.name}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('feedback-attachments')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Failed to upload file ${file.name}: ${uploadError.message}`);
      }

      // Generate signed URL (expires in 7 days)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('feedback-attachments')
        .createSignedUrl(filePath, 604800); // 7 days in seconds

      if (signedUrlError) {
        throw new Error(`Failed to create signed URL for ${file.name}: ${signedUrlError.message}`);
      }

      if (!signedUrlData) {
        throw new Error(`No signed URL data returned for ${file.name}`);
      }

      // Save attachment metadata
      const { error: attachmentError } = await supabase
        .from('feedback_attachments')
        .insert({
          feedback_id: feedbackId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          storage_url: signedUrlData.signedUrl
        });

      if (attachmentError) {
        throw new Error(`Failed to save attachment metadata for ${file.name}: ${attachmentError.message}`);
      }
    }
  }
}
