# Security Audit Report

**Date:** January 6, 2026  
**Auditor:** Security Review  
**Application:** Project Content Vault (Budgi)

---

## Executive Summary

This document outlines security risks identified in the codebase, categorized by severity. The application uses Supabase for authentication and database, with React/Vite on the frontend and Deno edge functions for serverless operations.

---

## 🔴 Critical Risks

### 1. Hardcoded Supabase Credentials in Source Code

**File:** `src/integrations/supabase/client.ts`

```typescript
const SUPABASE_PUBLISHABLE_KEY = loadEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') || 'eyJhbG...'
```

**Risk:** The anon key is hardcoded as a fallback. While anon keys are meant to be public, this pattern makes key rotation difficult and could expose credentials if the code is accidentally used with service role keys.

**Remediation:**
- Remove hardcoded fallback credentials
- Fail gracefully when environment variables are missing
- Document required environment variables clearly

---

### 2. Overly Permissive CORS Configuration

**Files:** All Edge Functions (`supabase/functions/*/index.ts`)

```typescript
'Access-Control-Allow-Origin': '*'
```

**Risk:** Allows any domain to make requests to your API endpoints, enabling potential CSRF attacks.

**Remediation:**
- Restrict to your application domains:
  ```typescript
  'Access-Control-Allow-Origin': 'https://yourdomain.com'
  ```
- For multiple domains, validate against an allowlist

---

### 3. Static Privacy Salt in Production

**File:** `supabase/migrations/20250823113441_...sql`

```sql
SELECT encode(digest(user_uuid::text || 'privacy_salt_2024', 'sha256'), 'hex');
```

**Risk:** Hardcoded salt makes hash cracking easier if the database is compromised.

**Remediation:**
- Use a secure environment variable for the salt
- Consider using Supabase Vault for secret storage

---

## 🟠 High Risks

### 4. XSS Vulnerabilities in DOM Manipulation

**File:** `src/hooks/useHoverableDateHeaders.ts`

```typescript
hoverOverlay.innerHTML = `<div class="...">`
tooltip.innerHTML = 'Go to Timeline';
```

**Risk:** Direct `innerHTML` assignments without sanitization. While the content here is static, this pattern is risky if extended with user data.

**Remediation:**
- Use `textContent` for plain text
- Use React's JSX rendering where possible
- If HTML is required, sanitize with DOMPurify

---

### 5. Insufficient Input Validation on Edge Functions

**Files:** `supabase/functions/*/index.ts`

The edge functions lack input validation/schemas. For example, `calendar-oauth` directly uses `connection_id` from user input without validation:

```typescript
const { connection_id, tokens } = await req.json()
```

**Risk:** SQL injection, type confusion, or unexpected behavior from malformed input.

**Remediation:**
- Add Zod or similar schema validation
- Validate UUIDs before database operations
- Sanitize all user input

---

### 6. No Rate Limiting on Authentication

**Risk:** No client-side or documented server-side rate limiting on login attempts. Vulnerable to brute force attacks.

**Remediation:**
- Implement client-side throttling after failed attempts
- Configure Supabase Auth rate limiting
- Consider CAPTCHA after multiple failures

---

### 7. Verbose Error Logging in Production

**Files:** Multiple edge functions and services

```typescript
console.log(`Deleting account for user: ${user.id}`);
console.error('Delete error:', deleteError);
```

**Risk:** User IDs and detailed errors logged to console could leak sensitive information in production logs.

**Remediation:**
- Use structured logging with severity levels
- Redact sensitive data (user IDs, emails)
- Conditionally log based on environment

---

## 🟡 Medium Risks

### 8. Missing Content Security Policy (CSP)

**File:** `index.html`

No CSP headers configured in `index.html` or server configuration.

**Risk:** Leaves the app vulnerable to XSS if any injection point is found.

**Remediation:**
Add to `index.html`:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co;">
```

---

### 9. localStorage for Sensitive Session Data

**Files:** `src/services/unified/UnifiedTimeTrackerService.ts`, `src/contexts/SettingsContext.tsx`

```typescript
localStorage.setItem(this.STORAGE_KEYS.selectedProject, JSON.stringify(trackingData.selectedProject));
```

**Risk:** Could be accessed by malicious scripts if XSS occurs.

**Remediation:**
- Store sensitive data server-side
- Use sessionStorage for temporary data
- Implement CSP to mitigate XSS risk

---

### 10. SECURITY DEFINER Functions Without Careful Audit

**Files:** Multiple migration files

Multiple PostgreSQL functions use `SECURITY DEFINER`, which runs with the owner's privileges.

**Risk:** If any function has SQL injection vulnerabilities, attackers could execute privileged operations.

**Remediation:**
- Audit all SECURITY DEFINER functions for injection
- Use parameterized queries only
- Minimize the number of SECURITY DEFINER functions

---

### 11. Rich Text Editor Attack Surface

**File:** `src/components/ui/rich-text-editor.tsx`

While DOMPurify is used (good!), the configuration allows `<a>` tags with `href` attributes:

```typescript
ALLOWED_TAGS: [...'a'...],
ALLOWED_ATTR: ['href', 'target'],
```

**Risk:** JavaScript URLs (`javascript:alert(1)`) could bypass sanitization.

**Remediation:**
Add URL protocol validation to DOMPurify config:
```typescript
ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
```

---

### 12. No Request Signing for Edge Functions

**Risk:** Edge functions rely solely on JWT for authentication. Replay attacks possible.

**Remediation:**
- Add timestamp validation (reject old requests)
- Consider request signing for sensitive operations
- Implement nonce for critical actions

---

## 🟢 Security Positives

| Area | Status | Notes |
|------|--------|-------|
| Row Level Security (RLS) | ✅ Implemented | Proper policies on all tables |
| Input Sanitization | ✅ DOMPurify | Used in rich text editor |
| OAuth Token Storage | ✅ Encrypted | Using Supabase Vault |
| Password Validation | ✅ Implemented | Length and complexity checks |
| Environment Files | ✅ Gitignored | `.env` files excluded |
| Auth Token Validation | ✅ Implemented | Edge functions verify JWT |
| Cascading Deletes | ✅ Configured | User data cleanup on deletion |

---

## AI-Produced App Specific Concerns

### Common AI-Generated Security Anti-Patterns Found:

1. **Boilerplate CORS `'*'`** - AI tools often generate permissive defaults
2. **Hardcoded fallback credentials** - Common in AI-generated Supabase integrations
3. **Missing security headers** - AI focuses on functionality over hardening
4. **Extensive console logging** - Debugging code that should be stripped

---

## Remediation Priority Matrix

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🔴 P0 | Remove hardcoded credentials | Low | High |
| 🔴 P0 | Restrict CORS origins | Low | High |
| 🟠 P1 | Add CSP headers | Medium | High |
| 🟠 P1 | Add input validation schemas | Medium | High |
| 🟠 P1 | Audit SECURITY DEFINER functions | Medium | High |
| 🟡 P2 | Implement rate limiting | Medium | Medium |
| 🟡 P2 | Strip production console logs | Low | Medium |
| 🟡 P2 | Add request signing | High | Medium |

---

## Recommended Action Plan

### Immediate (This Week)
1. Remove hardcoded credentials from `src/integrations/supabase/client.ts`
2. Restrict CORS origins in all edge functions
3. Add CSP meta tag to `index.html`

### Short-term (This Month)
1. Add Zod schema validation to edge functions
2. Audit all SECURITY DEFINER PostgreSQL functions
3. Configure structured logging with redaction

### Ongoing
1. Regular dependency updates (`npm audit`)
2. Security monitoring via Sentry (already integrated)
3. Periodic security reviews before major releases

---

## Resources

- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [DOMPurify Configuration](https://github.com/cure53/DOMPurify)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
