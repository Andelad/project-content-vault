# Resend Integration for Feedback Emails

## Quick Setup (1 hour)

Currently, user feedback goes to your database, but you won't know about it unless you check Supabase manually. This adds email notifications.

---

## Step 1: Create Resend Account (5 mins)

1. Go to https://resend.com/signup
2. Sign up (free tier: 100 emails/day, 3,000/month)
3. Get your API key from dashboard

---

## Step 2: Add Resend Secret to Supabase (2 mins)

```bash
# Using Supabase CLI
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx

# Or in Supabase Dashboard:
# Project → Settings → Edge Functions → Add secret
# Key: RESEND_API_KEY
# Value: your-resend-api-key
```

---

## Step 3: Create Edge Function (10 mins)

Create file: `supabase/functions/send-feedback-email/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  // CORS headers for local testing
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      } 
    })
  }

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
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; }
          .feedback-text { background: #f9fafb; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; }
          .meta { color: #6b7280; font-size: 14px; margin-top: 20px; }
          .button { background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">📬 New Feedback Received</h2>
          </div>
          
          <div class="content">
            <p><strong>Usage Context:</strong> ${usageLabels[usageContext] || usageContext}</p>
            <p><strong>Feedback Type:</strong> ${typeLabels[feedbackType] || feedbackType}</p>
            <p><strong>From:</strong> ${userEmail || 'Anonymous User'}</p>
            <p><strong>Feedback ID:</strong> <code>${feedbackId}</code></p>
            
            <div class="feedback-text">
              <strong>Message:</strong><br/>
              <p style="white-space: pre-wrap; margin: 10px 0 0 0;">${feedbackText}</p>
            </div>
            
            <a href="https://supabase.com/dashboard/project/_/editor/feedback?filter=id%3Aeq%3A${feedbackId}" class="button">
              View in Supabase
            </a>
            
            <div class="meta">
              <p>Received: ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'feedback@yourdomain.com', // Change this!
        to: 'hello@eido.studio',
        subject: `${typeLabels[feedbackType] || 'Feedback'} from ${usageLabels[usageContext] || 'User'}`,
        html: emailHtml
      })
    })

    const data = await res.json()
    
    if (!res.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(data)}`)
    }
    
    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        headers: { 
          "Content-Type": "application/json",
          'Access-Control-Allow-Origin': '*' 
        } 
      }
    )
  } catch (error) {
    console.error('Error sending feedback email:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { 
          "Content-Type": "application/json",
          'Access-Control-Allow-Origin': '*' 
        } 
      }
    )
  }
})
```

---

## Step 4: Deploy Edge Function (2 mins)

```bash
# Deploy to Supabase
supabase functions deploy send-feedback-email

# Test it works
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/send-feedback-email" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "feedbackId": "test-123",
    "usageContext": "university",
    "feedbackType": "bug",
    "feedbackText": "This is a test",
    "userEmail": "test@example.com"
  }'
```

---

## Step 5: Update FeedbackModal (15 mins)

Update `src/components/modals/FeedbackModal.tsx`:

Find the `handleSubmit` function and add this **after** the feedback is saved to database:

```typescript
// Around line 100, after feedbackError check

if (feedbackError) throw feedbackError;

// 🆕 ADD THIS: Send email notification via Edge Function
try {
  const { error: emailError } = await supabase.functions.invoke('send-feedback-email', {
    body: {
      feedbackId: feedbackData.id,
      usageContext: usageContext,
      feedbackType: feedbackType,
      feedbackText: feedbackText,
      userEmail: user?.email || 'Anonymous',
    }
  });

  if (emailError) {
    // Log but don't fail the whole submission
    console.warn('Email notification failed:', emailError);
    ErrorHandlingService.warn('Failed to send email notification', {
      source: 'FeedbackModal',
      metadata: { emailError }
    });
  }
} catch (emailError) {
  // Email is nice-to-have, don't block feedback submission
  console.warn('Email notification error:', emailError);
}

// Continue with attachment upload...
```

---

## Step 6: Configure Sender Domain (Important!)

### Option A: Use Resend Test Domain (Quick Start)
- Resend provides `onboarding@resend.dev` for testing
- Change `from:` in edge function to: `from: 'onboarding@resend.dev'`
- ✅ Works immediately
- ⚠️ May go to spam

### Option B: Use Your Own Domain (Recommended)
1. In Resend dashboard: Domains → Add Domain
2. Add DNS records to your domain:
   - MX record
   - TXT record (SPF)
   - CNAME (DKIM)
3. Verify domain (takes 5-30 mins)
4. Use `from: 'feedback@yourdomain.com'`

**Don't have a domain yet?**
- Use Resend test domain for now
- Or buy one: Namecheap, Google Domains ($12/year)

---

## Step 7: Test End-to-End (5 mins)

1. Go to your app
2. Open feedback modal
3. Submit feedback
4. Check:
   - ✅ Feedback in Supabase `feedback` table
   - ✅ Email in your inbox (hello@eido.studio)
   - ✅ No errors in browser console

---

## Troubleshooting

### Email Not Received

1. **Check Supabase Edge Function Logs**
   ```bash
   supabase functions logs send-feedback-email
   ```
   Or: Dashboard → Edge Functions → Logs

2. **Check Resend Dashboard**
   - Go to Logs
   - See if email was sent
   - Check for errors

3. **Check Spam Folder**
   - Especially if using test domain

4. **Verify API Key**
   ```bash
   supabase secrets list
   ```

### Error: "Failed to send email"

- Check RESEND_API_KEY is set correctly
- Check `from` email is valid
- Check Resend account is active
- Try test domain: `onboarding@resend.dev`

### Email Goes to Spam

- Verify your domain in Resend
- Add SPF/DKIM records
- Or accept it for MVP (you'll still get it)

---

## Cost Breakdown

**Resend Free Tier**:
- 100 emails/day
- 3,000 emails/month

**If you exceed**:
- $20/month for 50k emails
- Unlikely unless you have hundreds of users

**Supabase Edge Functions**:
- 500k invocations/month free
- Way more than you'll need

---

## Optional Enhancements

### 1. Add Attachment URLs to Email

Update edge function to include attachment links:

```typescript
const { feedbackId, usageContext, feedbackType, feedbackText, userEmail, attachmentUrls } = await req.json()

// In email HTML:
${attachmentUrls && attachmentUrls.length > 0 ? `
  <div class="attachments">
    <strong>Attachments:</strong>
    ${attachmentUrls.map(url => `
      <p><a href="${url}" target="_blank">${url.split('/').pop()}</a></p>
    `).join('')}
  </div>
` : ''}
```

Update FeedbackModal to pass attachment URLs:

```typescript
const attachmentUrls = attachments.map(file => 
  supabase.storage.from('feedback-attachments').getPublicUrl(filePath).data.publicUrl
);

// Pass to edge function
body: {
  // ... existing fields
  attachmentUrls: attachmentUrls,
}
```

### 2. Add Reply-To Header

Allow users to reply directly:

```typescript
body: JSON.stringify({
  from: 'feedback@yourdomain.com',
  to: 'hello@eido.studio',
  reply_to: userEmail, // 🆕 User can be contacted
  subject: `...`,
  html: emailHtml
})
```

### 3. Email Template Service

For fancier emails:
- Use Resend's built-in templates
- Or React Email: https://react.email/

---

## Alternative: Database Polling (No Resend)

If you don't want to use Resend, you could:

1. **Check Supabase Dashboard Daily**
   - Not scalable
   - Easy to miss feedback

2. **Build a Simple Admin Panel**
   - Show recent feedback
   - Add to your app behind auth
   - Check it daily

3. **Supabase Webhooks**
   - Free alternative
   - More complex setup
   - Sends HTTP POST to your endpoint on new feedback
   - Then forward to your email

---

## Summary

✅ **What you get**:
- Email notifications when users submit feedback
- Professional-looking emails
- Links to view in Supabase
- No more missed feedback

⏱️ **Time**: 1 hour
💰 **Cost**: Free (100 emails/day)
🎯 **Priority**: High (otherwise you won't know about feedback!)

---

## Quick Deploy Checklist

- [ ] Create Resend account
- [ ] Get API key
- [ ] Add secret to Supabase
- [ ] Create edge function file
- [ ] Deploy edge function
- [ ] Update FeedbackModal.tsx
- [ ] Configure sender domain (or use test)
- [ ] Test end-to-end
- [ ] Check spam folder
- [ ] Verify email received

**Ready to launch!** 🚀
