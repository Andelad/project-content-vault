import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Paperclip, X, Send } from 'lucide-react';
import { AppPageLayout } from '../layout/AppPageLayout';
import { Badge } from '../ui/badge';

export function FeedbackView() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
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

    setLoading(true);

    try {
      // TODO: Implement the actual submission logic
      // This will be handled by Lovable with Supabase integration
      
      // Placeholder for the submission
      console.log('Feedback submission:', {
        type: feedbackType,
        feedback: feedbackText,
        attachments: attachments.map(f => f.name)
      });

      toast({
        title: "Feedback submitted!",
        description: "Thank you for your feedback. We'll review it soon.",
      });

      // Reset form
      setFeedbackType('');
      setFeedbackText('');
      setAttachments([]);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
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
    <AppPageLayout className="bg-gray-50">
      {/* Content - Scrollable */}
      <AppPageLayout.Content className="flex-1 overflow-auto light-scrollbar p-0">
        <div className="p-8 space-y-6 max-w-4xl">

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Feedback Type Dropdown */}
              <div className="space-y-2">
                <Label htmlFor="feedback-type">What would you like to share?</Label>
                <Select value={feedbackType} onValueChange={setFeedbackType} defaultValue="like">
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

              {/* Submit Button */}
              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto"
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
          </CardContent>
        </Card>

        {/* Additional Info Card */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600">
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
          </CardContent>
        </Card>
        </div>
      </AppPageLayout.Content>
    </AppPageLayout>
  );
}
