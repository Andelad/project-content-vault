# Sentry Error Monitoring Integration

## Why Sentry?

Your `ErrorHandlingService` is already excellent - it logs everything to console. But in production:
- **You can't see console logs** from your users' browsers
- **You need alerts** when errors happen
- **You need context** (user info, breadcrumbs, environment)

Sentry captures all errors and sends them to a dashboard where you can:
- See stack traces
- Get email alerts
- Track error frequency
- See which users are affected
- Understand error patterns

**Free Tier**: 5,000 errors/month (perfect for starting out)

---

## Setup (15 minutes)

### 1. Create Sentry Account

1. Go to https://sentry.io/signup/
2. Create account (use GitHub OAuth)
3. Create new project → **React**
4. Copy your **DSN** (looks like: `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx`)

---

### 2. Install Sentry

```bash
npm install @sentry/react
```

---

### 3. Add DSN to Environment Variables

Add to `.env`:

```bash
VITE_SENTRY_DSN=https://your-sentry-dsn-here
```

Add to `.env.example`:

```bash
# Sentry Error Monitoring (optional)
VITE_SENTRY_DSN=
```

---

### 4. Initialize Sentry in Your App

Update `src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import './index.css';

// Initialize Sentry BEFORE rendering app
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    
    // Environment
    environment: import.meta.env.MODE,
    
    // Release tracking (optional)
    // release: 'your-app@1.0.0',
    
    // Performance monitoring (optional - uses quota)
    tracesSampleRate: 0.1, // 10% of transactions
    
    // Replay sessions (optional - very helpful for debugging)
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% when errors occur
    
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    
    // Filter out sensitive data
    beforeSend(event, hint) {
      // Don't send errors from browser extensions
      if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
        frame => frame.filename?.includes('extensions/')
      )) {
        return null;
      }
      
      // Filter out known non-critical errors
      const message = event.message || event.exception?.values?.[0]?.value || '';
      if (message.includes('ResizeObserver loop')) {
        return null; // Ignore resize observer noise
      }
      
      return event;
    },
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

### 5. Update ErrorHandlingService to Send to Sentry

Update `src/services/infrastructure/ErrorHandlingService.ts`:

```typescript
// Add this import at the top
import * as Sentry from '@sentry/react';

// ... existing code ...

export class ErrorHandlingService {
  // ... existing methods ...

  static handle(
    error: Error | string,
    context?: ErrorContext,
    options: {
      showToast?: boolean;
      severity?: ErrorSeverity;
      userMessage?: string;
    } = {}
  ): StructuredError {
    const {
      showToast = false,
      severity = ErrorSeverity.ERROR,
      userMessage
    } = options;

    // Create structured error
    const structuredError: StructuredError = {
      message: typeof error === 'string' ? error : error.message,
      severity,
      timestamp: new Date(),
      context,
      originalError: error instanceof Error ? error : undefined,
      stack: error instanceof Error ? error.stack : undefined
    };

    // Log to console with context
    this.logToConsole(structuredError);

    // Show user-facing toast if requested
    if (showToast) {
      this.showToast(structuredError, userMessage);
    }

    // Send to Sentry (only in production and for ERROR/CRITICAL)
    if (
      import.meta.env.PROD && 
      import.meta.env.VITE_SENTRY_DSN &&
      (severity === ErrorSeverity.ERROR || severity === ErrorSeverity.CRITICAL)
    ) {
      this.sendToSentry(structuredError);
    }

    return structuredError;
  }

  /**
   * Send error to Sentry with full context
   */
  private static sendToSentry(error: StructuredError): void {
    try {
      Sentry.withScope((scope) => {
        // Set severity
        scope.setLevel(
          error.severity === ErrorSeverity.CRITICAL ? 'fatal' : 
          error.severity === ErrorSeverity.ERROR ? 'error' : 
          error.severity === ErrorSeverity.WARNING ? 'warning' : 'info'
        );

        // Add context tags
        if (error.context?.source) {
          scope.setTag('source', error.context.source);
        }
        if (error.context?.action) {
          scope.setTag('action', error.context.action);
        }
        if (error.context?.userId) {
          scope.setUser({ id: error.context.userId });
        }

        // Add extra context
        if (error.context?.metadata) {
          scope.setContext('metadata', error.context.metadata);
        }

        // Add timestamp
        scope.setContext('error_details', {
          timestamp: error.timestamp.toISOString(),
          severity: error.severity,
        });

        // Capture the error
        if (error.originalError) {
          Sentry.captureException(error.originalError);
        } else {
          Sentry.captureMessage(error.message, 'error');
        }
      });
    } catch (sentryError) {
      // Don't let Sentry errors break the app
      console.error('Failed to send to Sentry:', sentryError);
    }
  }
}
```

---

### 6. Wrap App with Sentry Error Boundary

Update `src/App.tsx`:

```typescript
import * as Sentry from '@sentry/react';
import { ErrorBoundary as CustomErrorBoundary } from '@/components/debug/ErrorBoundary';

function App() {
  // ... your existing app code ...
}

// Only use Sentry error boundary in production
const AppWithErrorBoundary = import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN
  ? Sentry.withErrorBoundary(App, {
      fallback: ({ error, resetError }) => (
        <CustomErrorBoundary error={error} resetError={resetError} />
      ),
    })
  : App;

export default AppWithErrorBoundary;
```

Or wrap in `main.tsx`:

```typescript
const SentryErrorBoundary = import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN
  ? Sentry.ErrorBoundary
  : React.Fragment;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SentryErrorBoundary 
      fallback={({ error, resetError }) => (
        <div>An error occurred. Please refresh the page.</div>
      )}
    >
      <App />
    </SentryErrorBoundary>
  </React.StrictMode>
);
```

---

### 7. Set User Context (Optional but Recommended)

When user logs in, set their info in Sentry. Update your auth context or login handler:

```typescript
import * as Sentry from '@sentry/react';

// After successful login/signup
const setUserInSentry = (user: User) => {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
    });
  }
};

// On logout
const clearUserInSentry = () => {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.setUser(null);
  }
};
```

---

### 8. Test It Works

#### Development Test (Won't Send to Sentry)
In development, errors will only log to console.

#### Production Test
1. Build for production: `npm run build`
2. Preview: `npm run preview`
3. Intentionally trigger an error (add a button that throws)
4. Check Sentry dashboard: https://sentry.io/

**Test Error Button** (remove after testing):

```typescript
{import.meta.env.PROD && (
  <button 
    onClick={() => {
      throw new Error('Test Sentry Integration');
    }}
    className="hidden" // Hide but keep for testing
  >
    Test Error
  </button>
)}
```

---

## What You'll See in Sentry

1. **Error message and stack trace**
2. **Source** tag (from your ErrorHandlingService context)
3. **Action** tag (what the user was doing)
4. **User info** (email, ID)
5. **Breadcrumbs** (user actions leading up to error)
6. **Session replay** (video of what happened - if enabled)
7. **Browser/OS info**
8. **Frequency** (how many times this error occurred)

---

## Sentry Dashboard Navigation

- **Issues**: All errors grouped by similarity
- **Performance**: Slow queries/pages (if enabled)
- **Releases**: Track errors by version (if you set it up)
- **Alerts**: Set up email/Slack notifications

---

## Configure Alerts

1. Go to Settings → Alerts
2. Create alert:
   - "Send email when new issue created"
   - "Send email when error count > 10 in 1 hour"
3. Add your email or Slack webhook

---

## Cost Considerations

**Free Tier**:
- 5,000 errors/month
- 10,000 performance transactions/month
- 50 replay sessions/month

**If you exceed** (unlikely at first):
- Errors will still be logged locally via ErrorHandlingService
- You just won't see them in Sentry
- Consider upgrading ($26/month for 50k errors)

---

## Privacy Considerations

**Data Sentry Collects**:
- Error messages and stack traces
- User ID and email (if you set it)
- Browser/OS info
- URL where error occurred
- User actions (breadcrumbs)

**What to Avoid Sending**:
- Passwords (already filtered by Sentry)
- API keys (use `beforeSend` filter)
- Personal data in error messages
- Payment info

**GDPR Compliance**:
- Sentry is GDPR compliant
- Data stored in US or EU (you choose in settings)
- Users can request data deletion

---

## Alternative to Sentry

If you don't want to use Sentry:

### Option 1: LogRocket
- **Focus**: Session replay + errors
- **Free**: 1,000 sessions/month
- Similar setup to Sentry

### Option 2: PostHog
- **Focus**: Analytics + Errors + Session Replay (all-in-one)
- **Free**: 1M events/month
- Can self-host

### Option 3: Supabase Edge Function Log Aggregator
- **Cost**: Free (DIY)
- **Setup**: Create edge function that accepts error logs from client
- **Store**: In Supabase `error_logs` table
- **View**: Build custom dashboard
- **Pros**: Complete control, no 3rd party
- **Cons**: More work, no fancy features

---

## Debugging Tips

**If errors aren't showing in Sentry**:

1. Check DSN is correct
2. Check you're running in production mode (`npm run build && npm run preview`)
3. Check browser console for Sentry init errors
4. Check Sentry project settings → "Client Keys"
5. Make sure error severity is ERROR or CRITICAL (not WARNING/INFO)

**Too many errors?**
- Adjust `beforeSend` filter to ignore noise
- Check for infinite loops
- Filter out browser extension errors

---

## Summary

✅ **What Sentry gives you**:
- See errors from production users
- Email alerts for critical issues
- Full context (user, action, breadcrumbs)
- Track error trends over time

✅ **Your ErrorHandlingService still works** locally:
- All errors logged to console in development
- Toast notifications for users
- Structured error format

✅ **Zero impact on performance**:
- Only sends errors in production
- Async, doesn't block UI
- Can disable anytime by removing DSN

---

## Quick Start Checklist

- [ ] Create Sentry account
- [ ] Install `npm install @sentry/react`
- [ ] Add DSN to `.env`
- [ ] Update `main.tsx` to initialize Sentry
- [ ] Update `ErrorHandlingService.ts` to send to Sentry
- [ ] Test with production build
- [ ] Configure email alerts
- [ ] Add to deployment (Netlify/Vercel will pick up env var)

**Time**: 30 minutes
**Difficulty**: Easy (mostly copy-paste)
