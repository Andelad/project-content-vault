# Feedback Feature - Implementation Plan

**Status**: Phase 1 Complete (UI) | Phase 2 Pending (Backend Integration)  
**Date Created**: October 27, 2025  
**Target**: Lovable AI Assistant

---

## 📋 Feature Overview

A user feedback system that allows users to submit feedback, bug reports, and feature requests directly from the application. Feedback is stored in Supabase and can optionally trigger email notifications.

### Design Details
- **Form Title**: "Your feedback helps us improve our project"
- **Usage Context Options**:
  1. 🎓 University
  2. 💼 Freelance/Consultancy/Work
  3. 🏠 Personal Life
- **Feedback Types**:
  1. 💚 I like something
  2. 💔 I don't like something
  3. 🐛 I need to report a bug
  4. 💡 Feature request
- **File Support**: Images, PDFs, DOC, DOCX, TXT (optional)
- **Email Destination**: hello@eido.studio
- **Icon**: MessageCircle (speech bubble)

---

## ✅ Phase 1: UI Implementation (COMPLETED)

### Files Created/Modified:
1. **src/components/views/FeedbackView.tsx** - Complete feedback form UI
2. **src/components/layout/Sidebar.tsx** - Added feedback button with MessageCircle icon
3. **src/components/layout/MainAppLayout.tsx** - Added feedback view routing
4. **src/components/views/index.ts** - Exported FeedbackView
5. **tailwind.config.ts** - Added gray-150 custom color (#f0f0f0)

### Features Implemented:
- ✅ Feedback button in sidebar (above profile/settings border)
- ✅ MessageCircle icon for feedback button
- ✅ Complete feedback form with:
  - Usage context dropdown (University, Work, Personal)
  - Feedback type dropdown (4 options)
  - Textarea for detailed feedback
  - File attachment system with preview
  - Form validation
  - Loading and success states
  - Email display (hello@eido.studio)
- ✅ Lazy-loaded routing for performance
- ✅ Consistent styling with existing design system

---

## 🚧 Phase 2: Backend Integration (PENDING)

### Implementation Strategy

**Two-Phase Approach**:
- **Phase 2A (Required)**: Database storage only - simple, no external dependencies
- **Phase 2B (Optional)**: Email notifications via Resend - add when needed

---

## 📦 Phase 2A: Database Setup (Required for Launch)

This gets the feedback system working. Review feedback in Supabase dashboard.

### 1. Database Schema

Create `feedback` table:

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

-- Add indexes
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
```

### 2. Storage Setup (Optional)

**Note**: Skip if you want to disable file attachments initially.

Create storage bucket:

```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-attachments', 'feedback-attachments', false);

-- Storage policies
CREATE POLICY "Users can upload feedback attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own feedback attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

Create attachments table:

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

-- Policies
CREATE POLICY "Users can view their feedback attachments"
  ON feedback_attachments
  FOR SELECT
  TO authenticated
  USING (
    feedback_id IN (
      SELECT id FROM feedback WHERE user_id = auth.uid()
    )
  );

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

### 3. Update FeedbackView.tsx

Add import:

```typescript
import { supabase } from '@/integrations/supabase/client';
```

Replace TODO in `handleSubmit`:

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
        const { error: attachmentError } = await supabase
          .from('feedback_attachments')
          .insert({
            feedback_id: feedbackData.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type
          });

        if (attachmentError) throw attachmentError;
      }
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

### 4. Viewing Feedback

**In Supabase Dashboard**:
1. Go to Table Editor
2. Select `feedback` table
3. Filter by type, status, date, user

**Useful Queries**:

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

## 📧 Phase 2B: Email Notifications (Optional - Future Enhancement)

Add instant email notifications when ready.

### Requirements
- Resend account (https://resend.com)
- Free tier: 100 emails/day
- Verified domain or test domain

### 1. Edge Function

Create `supabase/functions/send-feedback-email/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  try {
    const { feedbackId, usageContext, feedbackType, feedbackText, userEmail } = await req.json()

    const usageLabels = {
      university: '🎓 University',
      work: '💼 Freelance/Consultancy/Work',
      personal: '🏠 Personal Life'
    }

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
        from: 'feedback@yourdomain.com',
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

Add to Supabase Edge Functions secrets:

```
RESEND_API_KEY=your_resend_api_key_here
```

### 3. Update handleSubmit

Add after feedback insert:

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

### Alternative Email Services

If not using Resend:
- **SendGrid**: More robust, complex setup
- **Mailgun**: Similar to Resend
- **Postmark**: Great for transactional emails
- **AWS SES**: Cheap, but complex
- **Webhooks**: Use Supabase webhooks → Zapier/Make.com → Email

---

## 🔒 Security & Rate Limiting (Recommended)

### Rate Limiting

```sql
CREATE OR REPLACE FUNCTION check_feedback_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- 1 minute cooldown
  IF EXISTS (
    SELECT 1 FROM feedback 
    WHERE user_id = NEW.user_id 
    AND created_at > NOW() - INTERVAL '1 minute'
  ) THEN
    RAISE EXCEPTION 'Please wait before submitting more feedback';
  END IF;
  
  -- 10 per day limit
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

CREATE TRIGGER feedback_rate_limit
  BEFORE INSERT ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION check_feedback_rate_limit();
```

### File Size Limits

Add to FeedbackView.tsx:

```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
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

## ✅ Testing Checklist

### Phase 2A (Database):
- [ ] Feedback button appears in sidebar
- [ ] Clicking navigates to feedback view
- [ ] All feedback types selectable
- [ ] Form validation works
- [ ] Files can be attached (if configured)
- [ ] Files can be removed
- [ ] Form submits successfully
- [ ] Data saved to Supabase
- [ ] Files uploaded to storage (if configured)
- [ ] Success toast appears
- [ ] Form resets after submission
- [ ] Error handling works
- [ ] Can view feedback in Supabase dashboard

### Phase 2B (Email - when added):
- [ ] Email sent to hello@eido.studio
- [ ] Email contains correct details
- [ ] Email errors don't break submission

---

## 📞 Troubleshooting

### Phase 2A Issues:
1. Check Supabase logs for database errors
2. Check browser console for client errors
3. Verify table permissions and RLS policies
4. Check storage bucket permissions (if using attachments)

### Phase 2B Issues:
1. Check Edge Function logs
2. Verify RESEND_API_KEY is set
3. Check Resend dashboard for delivery
4. Verify sender domain in Resend

---

## 📝 Implementation Notes

**Phase 1 (UI) - DONE**:
- Complete and ready
- No backend dependencies yet
- Form validates and shows loading states

**Phase 2A (Database) - REQUIRED**:
- Minimum viable backend
- No external services
- Review feedback in Supabase dashboard
- Simple and reliable

**Phase 2B (Email) - OPTIONAL**:
- Add when instant notifications needed
- Requires Resend account (100 free/day)
- Can be added anytime after Phase 2A

**General Notes**:
- UI matches existing design system
- Uses gray-150 hover states
- MessageCircle icon from lucide-react
- Responsive design
- Character count in textarea

---

## 🎯 Next Steps

1. ✅ ~~Phase 1: Build UI~~ **COMPLETE**
2. ⏳ Phase 2A: Implement database storage (Lovable)
3. ⏸️ Phase 2B: Add email notifications (Later, when needed)

**Ready for handoff to Lovable for Phase 2A implementation.**
