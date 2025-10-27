# Feedback Feature - Implementation Instructions for Lovable

## Overview
A feedback form has been created that allows users to submit feedback, bug reports, and feature requests. This document outlines the remaining implementation steps to connect the form to Supabase.

**Implementation Strategy**: We'll implement in two phases:
- **Phase 1 (Required)**: Store feedback in Supabase database - simple, no external dependencies
- **Phase 2 (Optional)**: Add email notifications via Resend when needed

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

---

## 📦 PHASE 1: Database Setup (Required)

This phase gets the feedback system working. You can review feedback directly in Supabase dashboard.

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

### 2. Storage Setup for Attachments (Optional)

**Note**: If you want to skip file attachments initially, you can skip this section and remove the file upload UI from FeedbackView.tsx.

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

### 3. Update FeedbackView.tsx - Basic Submission

Replace the TODO section in the `handleSubmit` function with this simplified version (no email):

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

    // Optional: Upload attachments if storage bucket is configured
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
-        uploadedAttachments.push(attachmentData);
      }
    }

-    // Send email notification via Edge Function
-    const { error: emailError } = await supabase.functions.invoke('send-feedback-email', {
-      body: {
-        feedbackId: feedbackData.id,
-        usageContext: usageContext,
-        feedbackType: feedbackType,
-        feedbackText: feedbackText,
-        userEmail: user?.email,
-        attachments: uploadedAttachments
-      }
-    });
-
-    if (emailError) {
-      console.error('Email notification error:', emailError);
-      // Don't fail the whole submission if email fails
-    }
-
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

### 4. Import Statement

Add to the top of FeedbackView.tsx:

```typescript
import { supabase } from '@/integrations/supabase/client';
```

---

## 📧 PHASE 2: Email Notifications (Optional - Add Later)

Once Phase 1 is working and you want instant email notifications, add this Edge Function.

### 1. Email Integration with Resend

**Requirements**:
- Sign up for Resend (https://resend.com) - Free: 100 emails/day
- Verify your domain or use their test domain  
- Get an API key

Create file: `supabase/functions/send-feedback-email/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  try {
    const { feedbackId, usageContext, feedbackType, feedbackText, userEmail } = await req.json()

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
      <hr>
      <p><small>View in Supabase: <a href="https://supabase.com/dashboard/project/_/editor/feedback">Dashboard</a></small></p>
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

### 2. Environment Variables

Add to your Supabase project settings (Edge Functions secrets):

```
RESEND_API_KEY=your_resend_api_key_here
```

### 3. Update FeedbackView.tsx handleSubmit

After the feedback insert (around line where we have `if (feedbackError) throw feedbackError;`), add:

```typescript
    // Send email notification via Edge Function
    const { error: emailError } = await supabase.functions.invoke('send-feedback-email', {
      body: {
        feedbackId: feedbackData.id,
        usageContext: usageContext,
        feedbackType: feedbackType,
        feedbackText: feedbackText,
        userEmail: user?.email,
      }
    });

    if (emailError) {
      console.error('Email notification error:', emailError);
      // Don't fail the whole submission if email fails
    }
```

---

## ✅ Testing Checklist

### Phase 1 Testing:
- [ ] Feedback button appears in sidebar above profile/settings
- [ ] Clicking feedback button navigates to feedback view
- [ ] All feedback types can be selected
- [ ] Form validation works (empty fields)
- [ ] Files can be attached (if storage configured)
- [ ] Files can be removed before submission
- [ ] Form submits successfully
- [ ] Data is saved to Supabase
- [ ] Files are uploaded to storage (if configured)
- [ ] Success toast appears
- [ ] Form resets after submission
- [ ] Error handling works for failed submissions
- [ ] Can view feedback in Supabase dashboard

### Phase 2 Testing (when added):
- [ ] Email is sent to hello@eido.studio
- [ ] Email contains correct feedback details
- [ ] Email sending errors don't break form submission

---

## 📊 Viewing Feedback

### In Supabase Dashboard:
1. Go to Table Editor
2. Select `feedback` table
3. View all submissions with filters by:
   - Type (like, dislike, bug, feature)
   - Status (new, reviewing, resolved, archived)
   - Date range
   - User

### Query Examples:

```sql
-- Get all bug reports
SELECT * FROM feedback WHERE feedback_type = 'bug' ORDER BY created_at DESC;

-- Get feedback from last 7 days
SELECT * FROM feedback WHERE created_at > NOW() - INTERVAL '7 days';

-- Get unresolved feedback
SELECT * FROM feedback WHERE status = 'new' ORDER BY created_at DESC;

-- Count by type
SELECT feedback_type, COUNT(*) 
FROM feedback 
GROUP BY feedback_type 
ORDER BY COUNT(*) DESC;
```

---

## 🎯 Alternative Email Solutions

If you don't want to use Resend, here are alternatives:

### Option 1: Database Triggers (No Code)
Set up a database webhook to notify you when feedback is inserted:
- Use Supabase Webhooks
- Point to Zapier/Make.com
- They send the email

### Option 2: Other Email Services
Replace Resend with:
- **SendGrid**: More robust, requires more setup
- **Mailgun**: Similar to Resend
- **Postmark**: Great for transactional emails
- **AWS SES**: Cheap, but complex setup

### Option 3: Just Use Supabase Dashboard
Check feedback periodically in Supabase dashboard. No email setup needed.

---

## 🔒 Security & Rate Limiting (Recommended)

Add these protections to prevent abuse:

### Rate Limiting SQL:

```sql
-- Add rate limiting check function
CREATE OR REPLACE FUNCTION check_feedback_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user has submitted feedback in last minute
  IF EXISTS (
    SELECT 1 FROM feedback 
    WHERE user_id = NEW.user_id 
    AND created_at > NOW() - INTERVAL '1 minute'
  ) THEN
    RAISE EXCEPTION 'Please wait before submitting more feedback';
  END IF;
  
  -- Check if user has submitted more than 10 times today
  IF (
    SELECT COUNT(*) FROM feedback 
    WHERE user_id = NEW.user_id 
    AND created_at > NOW() - INTERVAL '1 day'
  ) >= 10 THEN
    RAISE EXCEPTION 'Daily feedback limit reached';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
CREATE TRIGGER feedback_rate_limit
  BEFORE INSERT ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION check_feedback_rate_limit();
```

### File Size Limits:

In FeedbackView.tsx, add validation:

```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB total

// In file upload handler
if (file.size > MAX_FILE_SIZE) {
  toast({
    title: "File too large",
    description: "Maximum file size is 5MB",
    variant: "destructive"
  });
  return;
}

const totalSize = [...attachments, file].reduce((sum, f) => sum + f.size, 0);
if (totalSize > MAX_TOTAL_SIZE) {
  toast({
    title: "Total size too large",
    description: "Maximum total size is 10MB",
    variant: "destructive"
  });
  return;
}
```

---

## 📞 Support

If you encounter issues:

**Phase 1**:
1. Check Supabase logs for database errors
2. Check browser console for client-side errors
3. Verify table permissions and RLS policies
4. Check storage bucket permissions (if using attachments)

**Phase 2**:
1. Check Edge Function logs for email sending errors
2. Verify RESEND_API_KEY is set correctly
3. Check Resend dashboard for delivery status
4. Verify sender domain is verified in Resend

---

## 💡 Notes

**Phase 1 (Minimum Viable):**
- Feedback is stored in database
- You check Supabase dashboard periodically
- No external dependencies
- Simple and reliable

**Phase 2 (Nice to Have):**
- Instant email notifications
- Requires Resend account (100 free emails/day)
- Optional - can add anytime

**General:**
- File attachments support images, PDFs, DOC files, and text files
- The form includes character count for the feedback textarea
- The UI matches the existing design system (gray-150 hover states)
- The feedback button uses the MessageCircle icon from lucide-react
