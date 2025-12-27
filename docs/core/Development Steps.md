# Development Steps

- consider documenting features (creates maintenance issue, so only do so to improve logic/concepts)
- add sentry for centralised error handling
- add resend for feedback records
- what about notifications? And sending users emails?
- review database based on new logic. Also, do casesensitive migration with lovable

---

## Catch Errors As You Go (Linting & Type Checking)

### Setup Linting (Prevents 520+ errors accumulating)
- Check: `eslint.config.js` exists in project root
- Run: `npm run lint` (should already be configured)
- Fix auto-fixable issues: `npm run lint -- --fix`
- **Key**: Fix lint errors BEFORE committing, not after building for weeks

### Enable VS Code Auto-Linting
- Install: ESLint extension in VS Code
- Settings: Enable "Format on Save" + "ESLint: Auto Fix On Save"
- Result: Errors show as red squiggles while you type

### TypeScript Strict Mode
- Check: `tsconfig.json` has `"strict": true`
- Run: `npm run type-check` or `tsc --noEmit`
- Catches: Type errors, undefined handling, null issues BEFORE runtime

### Pre-Commit Hooks (Prevents committing bad code)
- Install: `npm install -D husky lint-staged`
- Setup: `npx husky install`
- Create: `.husky/pre-commit` runs `npm run lint` before every commit
- Blocks commit if lint fails

**The Problem You Hit:**
Built for weeks → Ran lint → 520 errors appeared all at once

**The Solution:**
Lint runs automatically:
- While typing (VS Code extension)
- Before committing (pre-commit hook)
- In CI/CD pipeline (GitHub Actions)

---

## Error-Proofing (Priority Order)

### 1. Unit Tests for Domain Rules
- Install: `npm install -D vitest @testing-library/react`
- Create: `src/domain/rules/__tests__/PhaseRules.test.ts`
- Test: Validation functions, edge cases, error messages
- Run: `npm run test`

### 2. Unit Tests for Calculations
- Create: `src/services/calculations/__tests__/autoEstimates.test.ts`
- Test: Auto-estimate distribution, working days counting, capacity calculations
- Focus: Critical math (remaining hours ÷ remaining working days)

### 3. Database Constraints
- Create: `INSTRUCTIONS_FOR_LOVABLE_DB_CONSTRAINTS.md`
- Add: NOT NULL (required fields), UNIQUE (client names, group names), CHECK (end_date > start_date), foreign keys
- Push to GitHub → Lovable executes migration

### 4. Integration Tests
- Test: Orchestrators calling domain rules
- Example: `ProjectOrchestrator.createProject()` validates via `PhaseRules.validate()`
- Run with: `npm run test:integration`

### 5. E2E Tests for Core Workflows
- Install: `npm install -D playwright`
- Create: `e2e/workflows/create-and-track-project.spec.ts`
- Test: Create project → Plan work → Complete work → Verify auto-estimates recalculate
- Run: `npx playwright test`

---

**Already Have:**
- TypeScript (compile-time type checking)
- Sentry (production error monitoring)
- ErrorHandlingService (structured logging)
- Supabase RLS (data isolation)

---

## Additional SaaS Essentials

### Performance Monitoring
- Install: `npm install @vercel/analytics` or similar
- Track: Page load times, slow queries, user interactions
- Alert: When response times exceed thresholds

### Database Performance
- Add indexes: Common query fields (user_id, project_id, date ranges)
- Monitor: Slow query logs in Supabase dashboard
- Optimize: N+1 queries, missing indexes, full table scans

### Data Backup & Recovery
- Setup: Supabase automatic backups (daily/hourly)
- Test: Restore process (actually practice recovering data)
- Document: Recovery procedures in runbook

### Security Audit
- Review: RLS policies cover all tables
- Check: No SQL injection vulnerabilities
- Verify: Sensitive data encrypted at rest
- Scan: `npm audit` for vulnerable dependencies

### Observability
- Logging: Structured logs to track user actions
- Metrics: Dashboard showing active users, errors, performance
- Alerts: Slack/email when error rate spikes

### Data Integrity
- Migration testing: Test schema changes on copy of production data
- Referential integrity: Foreign keys prevent orphaned records
- Audit logs: Track who changed what and when

### Deployment Pipeline
- Staging environment: Test changes before production
- Automated deploys: Push to main → auto-deploy (with rollback)
- Health checks: Verify app is running after deploy

### Documentation
- API docs: If you have external API
- Runbook: "What to do when X breaks"
- Incident response: Step-by-step for common issues

### User Data Protection
- GDPR compliance: Data export, deletion, consent
- Privacy policy: How you use data
- Terms of service: User agreement
- Data retention: How long you keep deleted data

### Rate Limiting
- Prevent: API abuse, spam, DoS attacks
- Implement: Supabase rate limiting or middleware
- Monitor: Unusual usage patterns

---

**Priority for Stability:**
1. ✅ Linting/Type checking (prevent code errors)
2. Database indexes (prevent slow queries)
3. Backup/recovery testing (prevent data loss)
4. Security audit (prevent breaches)
5. Performance monitoring (catch issues early)
6. Tests (prevent logic errors)