# Pre-Launch Checklist for User Onboarding

## 🔴 Critical (Must Have Before Launch)

### 1. Error Monitoring
**Status**: ⏳ Not Started  
**Why**: You need to know when things break in production  
**Options**:
- **Sentry** (Recommended) - Free 5k errors/month
- **PostHog** - Errors + Analytics + Session Replay
- **LogRocket** - Session replay focused

**Implementation**: See `SENTRY_INTEGRATION.md`

---

### 2. Feedback Email Notifications
**Status**: ⏳ Not Started  
**Why**: Currently feedback goes to database but you won't know about it  
**Solution**: Add Resend integration (100 free emails/day)

**Implementation**: See `docs/Implementation/FEEDBACK_FEATURE.md` Phase 2B

---

### 3. Legal Pages
**Status**: ⏳ Not Started  
**Why**: Required for GDPR/compliance, builds trust  
**What You Need**:
- Privacy Policy
- Terms of Service
- Cookie Policy (if using analytics)

**Tools**:
- https://www.termsfeed.com/
- https://www.privacypolicies.com/
- https://iubenda.com/ (recommended)

---

### 4. Database Backups
**Status**: ⏳ Check  
**Why**: Don't lose user data  
**Action**: 
1. Go to Supabase Dashboard → Settings → Database
2. Enable Point-in-Time Recovery (PITR) if on paid plan
3. Or set up daily backups via cron job

---

## 🟡 Important (Strongly Recommended)

### 5. Analytics
**Status**: ⏳ Not Started  
**Why**: Understand how users actually use your app  
**Privacy-Friendly Options**:
- **Plausible** ($9/month, 10k pageviews) - No cookies, GDPR compliant
- **Simple Analytics** (Similar pricing)
- **PostHog** (Free tier, self-hostable)
- **Umami** (Free, self-hosted)

**NOT recommended**: Google Analytics (privacy concerns)

---

### 6. Onboarding Flow
**Status**: 🤔 Review Needed  
**Why**: First-time users need guidance  
**Check**:
- [ ] Does a new user understand what to do first?
- [ ] Are there tooltips/guides for key features?
- [ ] Is there a welcome screen or tutorial?
- [ ] Can users easily create their first project/event?

**Tools**:
- Build custom with your existing Modal components
- Or use: Intro.js, Shepherd.js, Driver.js

---

### 7. Error Boundaries Everywhere
**Status**: ✅ Partial (have ErrorBoundary.tsx)  
**Check**:
- [ ] Wrap main app in ErrorBoundary
- [ ] Add boundaries around each major view
- [ ] Show user-friendly error screens

---

### 8. Performance Monitoring
**Status**: ⏳ Not Started  
**Why**: Slow = users leave  
**Options**:
- Built into Sentry/PostHog
- Google Lighthouse (free, manual)
- Web Vitals monitoring

---

## 🟢 Nice to Have (Can Add Later)

### 9. Status Page
**Why**: Show when services are down  
**Options**:
- **Status.io** (Free tier)
- **Atlassian Statuspage**
- Custom with Supabase + simple React page

---

### 10. User Documentation
**Status**: 🤔 Assess  
**What to Include**:
- Getting started guide
- Feature documentation
- FAQ
- Troubleshooting

**Tools**:
- Simple Notion page (free)
- GitBook
- Docusaurus (if you want to be fancy)

---

### 11. Changelog
**Why**: Keep users informed of updates  
**Options**:
- Simple `/changelog` page in your app
- https://headwayapp.co/
- https://changefeed.app/

---

### 12. Email Service (Beyond Feedback)
**For**: Welcome emails, password resets (Supabase handles), notifications  
**Current**: Supabase Auth emails (you're good!)  
**Optional**: Resend for marketing emails

---

### 13. Uptime Monitoring
**Why**: Know if your site goes down  
**Free Options**:
- **UptimeRobot** (50 monitors free)
- **Better Uptime** (Free tier)
- **Pingdom** (Limited free)

---

### 14. Security Headers
**Check**: https://securityheaders.com/  
**Action**: Add to `vite.config.ts` or Netlify/Vercel config

---

### 15. Rate Limiting
**Status**: 🤔 Check  
**Why**: Prevent API abuse  
**Current**: Does Supabase RLS handle this? Check policies

---

## 🧪 Testing Checklist

### Pre-Launch Testing
- [ ] Test signup flow (email confirmation)
- [ ] Test password reset
- [ ] Test on mobile (iOS Safari, Android Chrome)
- [ ] Test on tablet
- [ ] Test in different browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test slow network (Chrome DevTools throttling)
- [ ] Test with ad blockers enabled
- [ ] Test all feedback form scenarios
- [ ] Test error boundaries (intentionally break something)
- [ ] Load test with multiple users (optional for MVP)

---

## 📊 Monitoring Dashboard (Post-Launch)

Create a simple dashboard to check daily:
1. **Sentry**: New errors?
2. **Supabase**: User signups, active users
3. **Analytics**: Daily active users, bounce rate
4. **Feedback Table**: New feedback?
5. **Server Status**: Uptime?

---

## 🚀 Launch Day Checklist

- [ ] Error monitoring active
- [ ] Feedback emails working
- [ ] Analytics tracking
- [ ] Database backups enabled
- [ ] Legal pages live
- [ ] Status page setup (optional)
- [ ] All test scenarios passed
- [ ] Team has access to all admin tools
- [ ] Emergency contact plan (who to call if things break)

---

## 📞 Emergency Plan

**If Something Breaks**:
1. Check Sentry for errors
2. Check Supabase logs
3. Check browser console (ask user to send screenshot)
4. Check server status
5. Post on status page (if you have one)

**Key Contacts**:
- Supabase Status: https://status.supabase.com/
- Your error monitoring dashboard
- Your feedback email: hello@eido.studio

---

## Estimated Time Investment

**Critical Items**: ~4-6 hours
- Sentry setup: 30 mins
- Resend email: 1 hour
- Legal pages: 2 hours (using generator)
- Database backups: 15 mins
- Testing: 2 hours

**Important Items**: ~3-4 hours
**Nice to Have**: Do after launch based on user feedback

---

## Priority Order

1. **Set up Sentry** (30 mins) ← Do this first
2. **Test everything thoroughly** (2 hours)
3. **Add Resend for feedback** (1 hour)
4. **Legal pages** (2 hours)
5. **Enable backups** (15 mins)
6. **Analytics** (1 hour) - Can be added in first week
7. Everything else based on user feedback

