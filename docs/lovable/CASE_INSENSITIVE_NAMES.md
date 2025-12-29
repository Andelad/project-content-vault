# Case-Insensitive Name Uniqueness (Clients, Groups, Labels)

**Priority**: High (Groups critical - no constraint at all!)  
**Effort**: Medium (1-2 hours)  
**Status**: 🔴 Not Implemented  
**Created**: December 29, 2025  
**Verified**: December 29, 2025 - Requirements confirmed in App Logic & Business Logic

---

## 📋 Problem Statement

Three core entities need case-insensitive name uniqueness per user, but current implementation is broken:

### 1. ❌ **Clients** - Case-Sensitive Constraint
Users can create multiple clients with the same name but different casing:
- "Acme Corp"
- "ACME CORP" 
- "acme corp"

**Current Constraint:** `UNIQUE(user_id, name)` - case-sensitive

### 2. ❌ **Groups** - NO CONSTRAINT AT ALL! ⚠️
Users can create duplicate groups with the EXACT same name:
- "Work"
- "Work" (duplicate)
- "WORK" (also allowed)

**Current Constraint:** NONE - most critical issue!

### 3. ❌ **Labels** - Case-Sensitive Constraint
Users can create multiple labels with the same name but different casing:
- "#urgent"
- "#URGENT"
- "#Urgent"

**Current Constraint:** `UNIQUE(user_id, name)` - case-sensitive

---

## 🎯 Business Logic Requirements

**App Logic Documentation:**
- **Clients** (Line 187): "Client names must be unique per user, case-insensitive"
- **Groups** (Line 334): "Group names must be unique per user (case-insensitive: 'Work' and 'WORK' are treated as the same)"
- **Labels** (Line 368): "Label names must be unique per user (case-insensitive: '#urgent' and '#URGENT' are treated as the same)"

**Business Logic Invariants:**
- **Invariant 6** (Clients): `∀ client1, client2 WHERE client1.userId === client2.userId: LOWER(client1.name) !== LOWER(client2.name)`
- **Invariant 7** (Groups): `∀ group1, group2 WHERE group1.userId === group2.userId: LOWER(group1.name) !== LOWER(group2.name)`
- **Invariant 8** (Labels): `∀ label1, label2 WHERE label1.userId === label2.userId: LOWER(label1.name) !== LOWER(label2.name)`

---

## 🎯 Desired Behavior

**After Fix:**
- ✅ User can create "Acme Corp", "Work", "#urgent"
- ❌ User CANNOT create "ACME CORP", "WORK", "#URGENT" (would show error)
- ❌ User CANNOT create "acme corp", "work", "#Urgent" (would show error)
- ✅ Different users can still have entities with the same names (data isolation preserved)

---

## 🔧 Implementation Steps

### Step 1: Create Database Migration

Create a new Supabase migration file:

**File:** `supabase/migrations/[timestamp]_case_insensitive_names.sql`

```sql
-- ============================================================
-- Make Entity Names Case-Insensitive for Uniqueness
-- ============================================================
-- Entities: Clients, Groups, Labels
-- Impact: Ensures uniqueness across case variations
-- ============================================================

-- ============================================================
-- PART 1: Fix Clients Table
-- ============================================================

-- Drop existing case-sensitive unique constraint
ALTER TABLE public.clients 
  DROP CONSTRAINT IF EXISTS clients_user_id_name_key;

-- Create case-insensitive unique index
CREATE UNIQUE INDEX clients_user_id_name_lower_key 
  ON public.clients (user_id, LOWER(name));

COMMENT ON INDEX clients_user_id_name_lower_key IS 
  'Ensures client names are unique per user, case-insensitive (Business Logic Invariant 6)';

-- ============================================================
-- PART 2: Fix Groups Table (CRITICAL - No constraint exists!)
-- ============================================================

-- Create case-insensitive unique index (no existing constraint to drop)
CREATE UNIQUE INDEX groups_user_id_name_lower_key 
  ON public.groups (user_id, LOWER(name));

COMMENT ON INDEX groups_user_id_name_lower_key IS 
  'Ensures group names are unique per user, case-insensitive (Business Logic Invariant 7)';

-- ============================================================
-- PART 3: Fix Labels Table
-- ============================================================

-- Drop existing case-sensitive unique constraint
ALTER TABLE public.labels 
  DROP CONSTRAINT IF EXISTS labels_user_id_name_key;

-- Create case-insensitive unique index
CREATE UNIQUE INDEX labels_user_id_name_lower_key 
  ON public.labels (user_id, LOWER(name));

COMMENT ON INDEX labels_user_id_name_lower_key IS 
  'Ensures label names are unique per user, case-insensitive (Business Logic Invariant 8)';

-- ============================================================
-- Verification
-- ============================================================

DO $$ 
BEGIN
    -- Verify all three indexes exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'clients_user_id_name_lower_key'
    ) THEN
        RAISE EXCEPTION 'ERROR: clients_user_id_name_lower_key index does not exist!';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'groups_user_id_name_lower_key'
    ) THEN
        RAISE EXCEPTION 'ERROR: groups_user_id_name_lower_key index does not exist!';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'labels_user_id_name_lower_key'
    ) THEN
        RAISE EXCEPTION 'ERROR: labels_user_id_name_lower_key index does not exist!';
    END IF;
    
    RAISE NOTICE 'SUCCESS: All case-insensitive unique indexes created!';
END $$;
```

**Why this works:**
- Uses `LOWER(name)` to normalize names before comparison
- "Work" → "work", "WORK" → "work", "work" → "work"
- All variations map to same value, so only one can exist
- Preserves original casing for display

---

### Step 2: Update Domain Rules (Frontend Validation)

Update validation to match the backend behavior and provide helpful error messages.

#### File: `src/domain/rules/ClientRules.ts`

Add after existing RULE 1:

```typescript
  // ==========================================================================
  // RULE 1B: CLIENT NAME UNIQUENESS (CASE-INSENSITIVE)
  // ==========================================================================

  /**
   * RULE 1B: Check for duplicate client names (case-insensitive)
   *
   * Business Logic: Client names must be unique per user, ignoring case
   * Reference: Business Logic Invariant 6
   *
   * @param name - The client name to check
   * @param existingClients - All existing clients for this user
   * @param excludeClientId - Optional client ID to exclude (for updates)
   * @returns Object with availability status and conflicting client if found
   */
  static isClientNameAvailable(
    name: string,
    existingClients: Client[],
    excludeClientId?: string
  ): { available: boolean; conflictingClient?: Client } {
    const normalizedName = name.trim().toLowerCase();
    
    const conflict = existingClients.find(client => 
      client.name.toLowerCase() === normalizedName &&
      client.id !== excludeClientId
    );
    
    return {
      available: !conflict,
      conflictingClient: conflict
    };
  }
```

Update the `validateClient` method:

```typescript
  static validateClient(
    client: Partial<Client>,
    existingClients: Client[] = [],
    isUpdate: boolean = false
  ): ClientValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Name validation
    if (!client.name || !this.validateClientName(client.name)) {
      errors.push('Client name must be between 1 and 100 characters');
    } else {
      // Check for duplicate names (case-insensitive)
      const { available, conflictingClient } = this.isClientNameAvailable(
        client.name,
        existingClients,
        isUpdate ? client.id : undefined
      );
      
      if (!available && conflictingClient) {
        errors.push(
          `A client named "${conflictingClient.name}" already exists. ` +
          `Client names must be unique (case-insensitive).`
        );
      }
    }

    // Email validation
    if (client.contactEmail && !this.validateClientEmail(client.contactEmail)) {
      errors.push('Client email must be a valid email address');
    }

    // Phone validation
    if (client.contactPhone && !this.validateClientPhone(client.contactPhone)) {
      errors.push('Client phone contains invalid characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
```

#### File: `src/domain/rules/GroupRules.ts`

Create or update with similar pattern:

```typescript
  // ==========================================================================
  // RULE 1B: GROUP NAME UNIQUENESS (CASE-INSENSITIVE)
  // ==========================================================================

  /**
   * RULE 1B: Check for duplicate group names (case-insensitive)
   *
   * Business Logic: Group names must be unique per user, ignoring case
   * Reference: Business Logic Invariant 7
   *
   * @param name - The group name to check
   * @param existingGroups - All existing groups for this user
   * @param excludeGroupId - Optional group ID to exclude (for updates)
   * @returns Object with availability status and conflicting group if found
   */
  static isGroupNameAvailable(
    name: string,
    existingGroups: Group[],
    excludeGroupId?: string
  ): { available: boolean; conflictingGroup?: Group } {
    const normalizedName = name.trim().toLowerCase();
    
    const conflict = existingGroups.find(group => 
      group.name.toLowerCase() === normalizedName &&
      group.id !== excludeGroupId
    );
    
    return {
      available: !conflict,
      conflictingGroup: conflict
    };
  }
```

#### File: `src/domain/rules/LabelRules.ts`

Create or update with similar pattern:

```typescript
  // ==========================================================================
  // RULE 1B: LABEL NAME UNIQUENESS (CASE-INSENSITIVE)
  // ==========================================================================

  /**
   * RULE 1B: Check for duplicate label names (case-insensitive)
   *
   * Business Logic: Label names must be unique per user, ignoring case
   * Reference: Business Logic Invariant 8
   *
   * @param name - The label name to check
   * @param existingLabels - All existing labels for this user
   * @param excludeLabelId - Optional label ID to exclude (for updates)
   * @returns Object with availability status and conflicting label if found
   */
  static isLabelNameAvailable(
    name: string,
    existingLabels: Label[],
    excludeLabelId?: string
  ): { available: boolean; conflictingLabel?: Label } {
    const normalizedName = name.trim().toLowerCase();
    
    const conflict = existingLabels.find(label => 
      label.name.toLowerCase() === normalizedName &&
      label.id !== excludeLabelId
    );
    
    return {
      available: !conflict,
      conflictingLabel: conflict
    };
  }
```

---

### Step 3: Update Orchestrators

Update the create and update workflows to pass existing entities for validation.

#### File: `src/services/orchestrators/ClientOrchestrator.ts`

```typescript
static async createClientWorkflow(
  clientData: Partial<Client>
): Promise<ClientCreationResult> {
  try {
    // Get existing clients for duplicate check
    const existingClients = await this.getAllClients();
    
    // Validate client data (with duplicate check)
    const validation = ClientRules.validateClient(clientData, existingClients, false);
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // ... rest of existing code ...
  } catch (error) {
    // Check if it's a duplicate name error (from database constraint)
    if (error && typeof error === 'object' && 'code' in error) {
      const pgError = error as { code: string; message: string };
      if (pgError.code === '23505') { // Unique violation
        return {
          success: false,
          errors: ['A client with this name already exists (names are case-insensitive)']
        };
      }
    }
    
    ErrorHandlingService.handle(error, { 
      source: 'ClientOrchestrator', 
      action: 'createClientWorkflow error' 
    });
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Operation failed']
    };
  }
}

static async updateClientWorkflow(
  clientId: string,
  updates: Partial<Client>
): Promise<ClientUpdateResult> {
  try {
    // Get existing clients for duplicate check
    const existingClients = await this.getAllClients();
    
    // Validate updates (with duplicate check, excluding current client)
    const validation = ClientRules.validateClient(
      { ...updates, id: clientId }, 
      existingClients, 
      true
    );
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    // ... rest of existing code ...
  } catch (error) {
    // Same error handling as create
    if (error && typeof error === 'object' && 'code' in error) {
      const pgError = error as { code: string; message: string };
      if (pgError.code === '23505') {
        return {
          success: false,
          errors: ['A client with this name already exists (names are case-insensitive)']
        };
      }
    }
    
    ErrorHandlingService.handle(error, { 
      source: 'ClientOrchestrator', 
      action: 'updateClientWorkflow error' 
    });
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Operation failed']
    };
  }
}
```

Apply similar patterns to:
- `src/services/orchestrators/GroupOrchestrator.ts`
- `src/services/orchestrators/LabelOrchestrator.ts`

---

## 🧪 Testing Checklist

### Database Testing (Run BEFORE migration to find duplicates):

```sql
-- ============================================================
-- STEP 1: Check for existing duplicates (CRITICAL!)
-- ============================================================

-- Check Clients for case-insensitive duplicates
SELECT 
  user_id, 
  LOWER(name) as normalized_name,
  array_agg(name ORDER BY name) as variations,
  array_agg(id ORDER BY name) as client_ids,
  COUNT(*) as count
FROM clients
GROUP BY user_id, LOWER(name)
HAVING COUNT(*) > 1
ORDER BY user_id, normalized_name;

-- Check Groups for ANY duplicates (including exact matches!)
SELECT 
  user_id, 
  LOWER(name) as normalized_name,
  array_agg(name ORDER BY name) as variations,
  array_agg(id ORDER BY name) as group_ids,
  COUNT(*) as count
FROM groups
GROUP BY user_id, LOWER(name)
HAVING COUNT(*) > 1
ORDER BY user_id, normalized_name;

-- Check Labels for case-insensitive duplicates
SELECT 
  user_id, 
  LOWER(name) as normalized_name,
  array_agg(name ORDER BY name) as variations,
  array_agg(id ORDER BY name) as label_ids,
  COUNT(*) as count
FROM labels
GROUP BY user_id, LOWER(name)
HAVING COUNT(*) > 1
ORDER BY user_id, normalized_name;
```

**If duplicates exist - CLEANUP REQUIRED:**

```sql
-- Example cleanup for Groups (adapt for Clients/Labels):
-- 1. Identify which to keep (usually the oldest one)
-- 2. Update all references to point to the one you're keeping
-- 3. Delete the duplicates

-- Update projects to use the primary group
UPDATE projects 
SET group_id = 'keep-this-group-id'
WHERE group_id IN ('duplicate-group-id-1', 'duplicate-group-id-2');

-- Delete the duplicates
DELETE FROM groups WHERE id IN ('duplicate-group-id-1', 'duplicate-group-id-2');
```

### Manual Testing (AFTER migration):

#### Clients:
1. ✅ Create client "Acme Corp"
2. ❌ Try to create "ACME CORP" → Should show error
3. ❌ Try to create "acme corp" → Should show error
4. ❌ Try to create "  Acme Corp  " (with spaces) → Should show error
5. ✅ Update "Acme Corp" to "Acme Corporation" → Should succeed
6. ✅ Different user can create "Acme Corp" → Should succeed

#### Groups:
1. ✅ Create group "Work"
2. ❌ Try to create "WORK" → Should show error
3. ❌ Try to create "work" → Should show error
4. ✅ Update "Work" to "Work Projects" → Should succeed

#### Labels:
1. ✅ Create label "#urgent"
2. ❌ Try to create "#URGENT" → Should show error
3. ❌ Try to create "#Urgent" → Should show error
4. ✅ Update "#urgent" to "#high-priority" → Should succeed

---

## 📊 Migration Safety

**Risk Level:** Medium (Groups is critical due to missing constraint)

**Why It's Mostly Safe:**
1. Uses `CREATE UNIQUE INDEX` instead of constraint (can be dropped/recreated easily)
2. Only affects new inserts/updates (existing data unchanged)
3. Can be rolled back if needed

**Why Groups is Critical:**
- Currently has NO uniqueness constraint at all
- Users can create exact duplicates: "Work", "Work", "Work"
- This is a data integrity violation
- Must check for exact duplicates before migration

**Rollback Plan:**

```sql
-- Rollback: Drop the new indexes

DROP INDEX IF EXISTS public.clients_user_id_name_lower_key;
DROP INDEX IF EXISTS public.groups_user_id_name_lower_key;
DROP INDEX IF EXISTS public.labels_user_id_name_lower_key;

-- Restore original constraints (Clients and Labels only)
ALTER TABLE public.clients 
  ADD CONSTRAINT clients_user_id_name_key 
  UNIQUE (user_id, name);

ALTER TABLE public.labels 
  ADD CONSTRAINT labels_user_id_name_key 
  UNIQUE (user_id, name);

-- Note: Groups never had a constraint, so nothing to restore
```

---

## 📚 Related Documentation

### App Logic:
- `docs/core/App Logic.md` - Entity 2 (Client), lines 171-210
- `docs/core/App Logic.md` - Entity 5 (Group), lines 323-354
- `docs/core/App Logic.md` - Entity 6 (Label), lines 356-386

### Business Logic:
- `docs/core/Business Logic.md` - Invariant 6 (Client Name Uniqueness), lines 757-768
- `docs/core/Business Logic.md` - Invariant 7 (Group Name Uniqueness), lines 769-779
- `docs/core/Business Logic.md` - Invariant 8 (Label Name Uniqueness), lines 781-791

### Code Files:
- Domain Rules: `src/domain/rules/ClientRules.ts`, `GroupRules.ts`, `LabelRules.ts`
- Orchestrators: `src/services/orchestrators/ClientOrchestrator.ts`, `GroupOrchestrator.ts`, `LabelOrchestrator.ts`
- Type Definitions: `src/types/core.ts`

### Database Migrations:
- Clients table: `supabase/migrations/20251021122309_23998210-283c-42f4-855f-1b34a066a5e9.sql` (line 16)
- Groups table: `supabase/migrations/20250815134829_bcddadf4-c503-44f9-a311-9e2b3a2a94d1.sql` (line 2)
- Labels table: `supabase/migrations/20251021122309_23998210-283c-42f4-855f-1b34a066a5e9.sql` (line 60)

---

## 🎓 Learning Resources

**PostgreSQL Unique Indexes:**
- https://www.postgresql.org/docs/current/indexes-unique.html

**Case-Insensitive Comparisons:**
- https://www.postgresql.org/docs/current/functions-string.html

**Supabase Migrations:**
- https://supabase.com/docs/guides/database/migrations

---

## 📝 Notes

- Display names will still show in their original casing
- Groups fix is CRITICAL - currently has no uniqueness constraint at all
- This pattern aligns with Business Logic formal invariants 6, 7, and 8
- After implementation, update status in this document to ✅ Implemented
- Consider auditing other entities for similar uniqueness requirements
- The old single-entity document (CASE_INSENSITIVE_CLIENT_NAMES.md) can be archived after this is implemented

---

## ⚠️ IMPORTANT: Pre-Migration Requirements

**DO NOT RUN MIGRATION UNTIL:**

1. ✅ All duplicate detection queries have been run
2. ✅ All duplicates have been cleaned up (especially Groups!)
3. ✅ Cleanup has been verified with re-running the detection queries
4. ✅ Backup has been created (just in case)

**Groups is the most critical** because it currently has no constraint at all. Users may have created exact duplicates that will cause the migration to fail.
