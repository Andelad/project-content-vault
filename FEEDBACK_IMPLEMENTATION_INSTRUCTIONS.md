# Feedback Feature - Implementation Instructions for Lovable

## Overview
A feedback form has been created that allows users to submit feedback, bug reports, and feature requests. This document outlines the remaining implementation steps to connect the form to Supabase and send emails to hello@eido.studio.

## Current Implementation

### Files Created/Modified:
1. **src/components/views/FeedbackView.tsx** - Complete feedback form UI
2. **src/components/layout/Sidebar.tsx** - Added feedback button with MessageCircle icon
3. **src/components/layout/MainAppLayout.tsx** - Added feedback view routing
4. **src/components/views/index.ts** - Exported FeedbackView
5. **tailwind.config.ts** - Added gray-150 custom color

### Features Implemented:
- ✅ Feedback button in sidebar (above the border separating profile/settings)
- ✅ MessageCircle icon for feedback button
- ✅ Complete feedback form with:
  - Feedback type dropdown (I like something, I don't like something, Bug report, Feature request)
  - Textarea for detailed feedback
  - File/screenshot attachment support
  - Form validation
  - Loading states
  - Success/error toast notifications

## Required Implementation by Lovable

### 1. Database Setup

Create a new table in Supabase called `feedback`:

```sql
CREATE TABLE feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_context text NOT NULL CHECK (usage_context IN ('university', 'work', 'personal')),
  feedback_type text NOT NULL CHECK (feedback_type IN ('like', 'dislike', 'bug', 'feature')),
  feedback_text text NOT NULL,
  user_email text,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'archived')),
  
  -- Metadata
  user_agent text,
  url text
);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
  ON feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
  ON feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add index for better query performance
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
```

### 2. Storage Setup for Attachments

Create a storage bucket for feedback attachments:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-attachments', 'feedback-attachments', false);

-- Storage policy: Users can upload their own feedback attachments
CREATE POLICY "Users can upload feedback attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policy: Users can view their own feedback attachments
CREATE POLICY "Users can view their own feedback attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

Create a junction table for feedback attachments:

```sql
CREATE TABLE feedback_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id uuid REFERENCES feedback(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE feedback_attachments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view attachments for their feedback
CREATE POLICY "Users can view their feedback attachments"
  ON feedback_attachments
  FOR SELECT
  TO authenticated
  USING (
    feedback_id IN (
      SELECT id FROM feedback WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert attachments for their feedback
CREATE POLICY "Users can insert their feedback attachments"
  ON feedback_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    feedback_id IN (
      SELECT id FROM feedback WHERE user_id = auth.uid()
    )
  );
```

### 3. Email Integration

Set up Supabase Edge Function to send feedback emails to hello@eido.studio.

Create file: `supabase/functions/send-feedback-email/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  try {
    const { feedbackId, usageContext, feedbackType, feedbackText, userEmail, attachments } = await req.json()

    // Map usage context to readable label
    const usageLabels = {
      university: '🎓 University',
      work: '💼 Freelance/Consultancy/Work',
      personal: '🏠 Personal Life'
    }

    // Map feedback type to readable label
    const typeLabels = {
      like: '💚 I like something',
      dislike: "💔 I don't like something",
      bug: '🐛 Bug Report',
      feature: '💡 Feature Request'
    }

    const emailHtml = `
      <h2>New Feedback Received</h2>
      <p><strong>Usage Context:</strong> ${usageLabels[usageContext] || usageContext}</p>
      <p><strong>Type:</strong> ${typeLabels[feedbackType] || feedbackType}</p>
      <p><strong>From:</strong> ${userEmail || 'Anonymous'}</p>
      <p><strong>Feedback ID:</strong> ${feedbackId}</p>
      <hr>
      <h3>Feedback:</h3>
      <p style="white-space: pre-wrap;">${feedbackText}</p>
      ${attachments && attachments.length > 0 ? `
        <hr>
        <h3>Attachments:</h3>
        <ul>
          ${attachments.map(att => `<li>${att.file_name} (${att.file_size} bytes)</li>`).join('')}
        </ul>
      ` : ''}
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'feedback@yourdomain.com', // Configure your verified domain
        to: 'hello@eido.studio',
        subject: `New ${typeLabels[feedbackType] || 'Feedback'} from User`,
        html: emailHtml
      })
    })

    const data = await res.json()
    
    return new Response(
      JSON.stringify(data),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
```

### 4. Update FeedbackView.tsx

Replace the TODO section in the `handleSubmit` function with:

```typescript
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
    const uploadedAttachments = [];
    if (attachments.length > 0) {
      for (const file of attachments) {
        const filePath = `${user?.id}/${feedbackData.id}/${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('feedback-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save attachment metadata
        const { data: attachmentData, error: attachmentError } = await supabase
          .from('feedback_attachments')
          .insert({
            feedback_id: feedbackData.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type
          })
          .select()
          .single();

        if (attachmentError) throw attachmentError;
        uploadedAttachments.push(attachmentData);
      }
    }

    // Send email notification via Edge Function
    const { error: emailError } = await supabase.functions.invoke('send-feedback-email', {
      body: {
        feedbackId: feedbackData.id,
        usageContext: usageContext,
        feedbackType: feedbackType,
        feedbackText: feedbackText,
        userEmail: user?.email,
        attachments: uploadedAttachments
      }
    });

    if (emailError) {
      console.error('Email notification error:', emailError);
      // Don't fail the whole submission if email fails
    }

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
```

### 5. Environment Variables

Add to your Supabase project settings:

```
RESEND_API_KEY=your_resend_api_key_here
```

You'll need to sign up for Resend (https://resend.com) and:
1. Verify your domain or use their test domain
2. Get an API key
3. Add it to Supabase Edge Functions secrets

### 6. Import Statement

Add to the top of FeedbackView.tsx:

```typescript
import { supabase } from '@/integrations/supabase/client';
```

## Testing Checklist

After implementation, test:

- [ ] Feedback button appears in sidebar above profile/settings
- [ ] Clicking feedback button navigates to feedback view
- [ ] All feedback types can be selected
- [ ] Form validation works (empty fields)
- [ ] Files can be attached
- [ ] Files can be removed before submission
- [ ] Form submits successfully
- [ ] Data is saved to Supabase
- [ ] Files are uploaded to storage
- [ ] Email is sent to hello@eido.studio
- [ ] Success toast appears
- [ ] Form resets after submission
- [ ] Error handling works for failed submissions

## Alternative Email Solution (If Resend Not Available)

If you can't use Resend, you can use Supabase's built-in email functionality or set up a webhook to a service like SendGrid, Mailgun, or Postmark. Let me know if you need instructions for an alternative approach.

## Support

If you encounter any issues during implementation, check:
1. Supabase logs for database errors
2. Edge Function logs for email sending errors
3. Browser console for client-side errors
4. Storage bucket permissions

## Notes

- The feedback form is fully responsive
- File attachments support images, PDFs, DOC files, and text files
- The form includes character count for the feedback textarea
- The UI matches the existing design system (gray-150 hover states)
- The feedback button uses the MessageCircle icon from lucide-react
