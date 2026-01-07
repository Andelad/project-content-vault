import React, { useState } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '@/hooks/ui/use-toast';
import { Paperclip, X, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ErrorHandlingService } from '@/infrastructure/ErrorHandlingService';

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [usageContext, setUsageContext] = useState('university');
  const [feedbackType, setFeedbackType] = useState('like');
  const [feedbackText, setFeedbackText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedbackType) {
      toast({
        title: "Error",
        description: "Please select a feedback type",
        variant: "destructive"
      });
      return;
    }

    if (!feedbackText.trim()) {
      toast({
        title: "Error",
        description: "Please provide your feedback",
        variant: "destructive"
      });
      return;
    }

    // Validate file sizes
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB total
    
    for (const file of attachments) {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the 5MB limit`,
          variant: "destructive"
        });
        return;
      }
    }
    
    const totalSize = attachments.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      toast({
        title: "Total size too large",
        description: "Maximum total attachment size is 10MB",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Insert feedback into database
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedback')
        .insert({
          user_id: user?.id,
          usage_context: usageContext,
          feedback_type: feedbackType,
          feedback_text: feedbackText,
          user_email: user?.email,
          user_agent: navigator.userAgent,
          url: window.location.href
        })
        .select()
        .single();

      if (feedbackError) throw feedbackError;

      // Upload attachments if any
      if (attachments.length > 0 && feedbackData) {
        for (const file of attachments) {
          const filePath = `${user?.id}/${feedbackData.id}/${file.name}`;
          
          const { error: uploadError } = await supabase.storage
            .from('feedback-attachments')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // Generate signed URL (expires in 7 days)
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('feedback-attachments')
            .createSignedUrl(filePath, 604800); // 7 days in seconds

          if (signedUrlError) throw signedUrlError;

          // Save attachment metadata with signed URL
          const { error: attachmentError } = await supabase
            .from('feedback_attachments')
            .insert({
              feedback_id: feedbackData.id,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              mime_type: file.type,
              storage_url: signedUrlData.signedUrl
            });

          if (attachmentError) throw attachmentError;
        }
      }

      toast({
        title: "Feedback submitted!",
        description: "Thank you for your feedback. We'll review it soon.",
      });

      // Reset form and close modal
      setUsageContext('university');
      setFeedbackType('like');
      setFeedbackText('');
      setAttachments([]);
      onOpenChange(false);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'FeedbackModal', action: 'Error submitting feedback:' });
      
      let errorMessage = "Failed to submit feedback. Please try again.";
      const message = error instanceof Error ? error.message : undefined;
      
      if (message?.includes('rate limit')) {
        errorMessage = message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-900">Send Feedback</h2>
            <p className="text-sm text-gray-600 mt-1">
              Help us improve Budgi by sharing your thoughts
            </p>
          </div>

          {/* Content - Scrollable */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto light-scrollbar flex flex-col">
            <div className="flex-1 p-6 space-y-6">
              {/* Usage Context Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="usage-context">I mainly use Budgi for...</Label>
                <Select value={usageContext} onValueChange={setUsageContext}>
                  <SelectTrigger id="usage-context">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="university">🎓 University</SelectItem>
                    <SelectItem value="work">💼 Freelance/Consultancy/Work</SelectItem>
                    <SelectItem value="personal">🏠 Personal Life</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Feedback Type Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="feedback-type">What would you like to share?</Label>
                <Select value={feedbackType} onValueChange={setFeedbackType}>
                  <SelectTrigger id="feedback-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="like">💚 I like something</SelectItem>
                    <SelectItem value="dislike">💔 I don't like something</SelectItem>
                    <SelectItem value="bug">🐛 I need to report a bug</SelectItem>
                    <SelectItem value="feature">💡 Feature request</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Feedback Text Area */}
              <div className="space-y-2">
                <Label htmlFor="feedback-text">Your Feedback</Label>
                <Textarea
                  id="feedback-text"
                  placeholder="Please provide as much detail as possible..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={8}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
                  {feedbackText.length} characters
                </p>
              </div>

              {/* File Attachments */}
              <div className="space-y-2">
                <Label>Attachments (Optional)</Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      className="w-full"
                    >
                      <Paperclip className="w-4 h-4 mr-2" />
                      Attach Files or Screenshots
                    </Button>
                    <input
                      id="file-upload"
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  {/* Display attached files */}
                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Paperclip className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttachment(index)}
                            className="flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  You can attach images, screenshots, or documents (PDF, DOC, TXT)
                </p>
              </div>

              {/* Additional Info */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-gray-700">
                  <p className="mb-2">
                    <strong>Note:</strong> Your feedback will be sent to our team at{' '}
                    <a href="mailto:hello@eido.studio" className="text-blue-600 hover:underline">
                      hello@eido.studio
                    </a>
                  </p>
                  <p>
                    We review all feedback carefully and use it to improve our product. 
                    While we may not be able to respond to every submission individually, 
                    we appreciate you taking the time to help us improve.
                  </p>
                </div>
              </div>

            </div>

            {/* Submit Buttons - Fixed Footer */}
            <div className="border-t border-gray-200 p-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
