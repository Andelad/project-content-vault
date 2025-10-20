# 🗃️ Database Cleanup Instructions for Lovable

## Overview
This document outlines database cleanup tasks to optimize the Supabase database schema and remove redundant structures.

## 🔴 High Priority Cleanup Tasks

### 1. Remove Duplicate Milestones Table Creation
**Issue**: Two identical migrations create the same `milestones` table
- `20250820000000_add_milestones_table.sql`
- `20250820202150_26ca92de-eeb0-4506-acaf-757147e23900.sql`

**Action Required**:
- Keep the first migration: `20250820000000_add_milestones_table.sql`
- Delete the redundant migration: `20250820202150_26ca92de-eeb0-4506-acaf-757147e23900.sql`
- Verify no data loss by checking both migrations are identical

### 2. Consolidate Redundant Function Definitions
**Issue**: `hash_user_id()` function is redefined 3 times unnecessarily
- `20250823113352_5b9efe43-ffd4-4a70-b6f1-116fbd8a18a1.sql`
- `20250823113441_9203de9f-811b-4811-94c1-170fc0fafc2c.sql`
- `20250823113744_46998294-c44a-464a-8041-8145cf85b3c0.sql`

**Action Required**:
- Keep only the latest definition from `20250823113744_46998294-c44a-464a-8041-8145cf85b3c0.sql`
- Remove the function definitions from the two earlier migrations
- Verify the function is still available in the database

### 3. Remove Preview/Cleanup Scripts
**Issue**: `preview_milestone_cleanup.sql` is a read-only preview script no longer needed

**Action Required**:
- Delete the file `supabase/migrations/preview_milestone_cleanup.sql`
- This file was only used for planning and contains no schema changes

## 🟡 Medium Priority Cleanup Tasks

### 4. Consolidate Small Migrations
**Issue**: 37 migration files is excessive; many small changes could be combined

**Small migrations to consider combining**:
- `20251018135545_8640cf1c-d7f1-4916-9b92-d6e7f143a3a9.sql` (1 line - RLS enablement)
- `20250822161600_add_continuous_to_projects.sql` (6 lines - column addition)
- `20250815195618_add_default_view_to_settings.sql` (6 lines - column addition)

**Action Required**:
- Review migration history and combine related small changes
- Create consolidated migrations for logical groups of changes
- Test thoroughly in staging before applying

### 5. Review Backup Tables
**Issue**: `milestones_backup_20251018` table from cleanup operations

**Action Required**:
- Assess if backup data is still needed
- If not needed: drop table and remove related migration
- If needed: document retention policy and cleanup schedule

### 6. Clean Up Unused Database Objects
**Action Required**:
- Identify unused indexes, functions, or constraints
- Use Supabase query performance insights to find unused indexes
- Remove functions that are no longer called by application code

## 🟢 Low Priority Optimization Tasks

### 7. Migration History Optimization
**Action Required**:
- Consider squashing old migrations into a single "initial schema" migration
- This reduces migration file count and improves deployment performance
- Keep recent migrations separate for easier rollback

### 8. Add Database Documentation
**Action Required**:
- Add table and column comments where missing
- Document complex business logic in schema comments
- Update existing comments to reflect current usage

## ⚠️ Safety Guidelines

### Pre-Cleanup Checklist:
- [ ] Create full database backup
- [ ] Test all cleanup operations in staging environment first
- [ ] Verify no application code depends on removed objects
- [ ] Check that all RLS policies still work correctly
- [ ] Run full test suite after each cleanup batch

### Cleanup Process:
1. **Phase 1**: Remove obviously redundant files (duplicate migrations, preview scripts)
2. **Phase 2**: Consolidate small migrations (test thoroughly)
3. **Phase 3**: Clean up unused objects (verify no dependencies)
4. **Phase 4**: Optimize migration history (optional performance improvement)

### Rollback Plan:
- Keep backups of all removed migration files
- Document which objects were removed and why
- Have database restore procedure ready

## 📋 Verification Queries

After cleanup, run these queries to verify database health:

```sql
-- Check for orphaned objects
SELECT schemaname, tablename, tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check function definitions
SELECT proname, prokind, prosrc
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- Check indexes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## 🎯 Success Criteria

- [ ] No duplicate table/function definitions
- [ ] Migration count reduced by at least 20%
- [ ] All application functionality still works
- [ ] Database performance maintained or improved
- [ ] Schema is well-documented with comments

---

**Note**: This cleanup focuses on schema optimization and redundancy removal. Data cleanup (removing old records) is a separate task that should be handled based on business requirements.</content>
<parameter name="filePath">/Users/andyjohnston/project-content-vault/DATABASE_CLEANUP_INSTRUCTIONS.md
