# Case-Insensitive Client Name Uniqueness

**Priority**: Medium  
**Effort**: Low (30-60 minutes)  
**Status**: 🔴 Not Implemented  
**Created**: December 26, 2025

---

## 📋 Problem Statement

Currently, users can create multiple clients with the same name but different casing:
- ❌ "Acme Corp"
- ❌ "ACME CORP"
- ❌ "acme corp"

This creates confusion and data quality issues. Users likely intend these to be the same client.

**Current Constraint:**
```sql
UNIQUE(user_id, name)
```
This is **case-sensitive** in PostgreSQL, so "Acme Corp" ≠ "acme corp"

---

## 🎯 Desired Behavior

**After Fix:**
- ✅ User can create "Acme Corp"
- ❌ User CANNOT create "ACME CORP" (would show error: "Client 'ACME CORP' already exists")
- ❌ User CANNOT create "acme corp" (would show error: "Client 'acme corp' already exists")

**Note:** Different users can still have clients with the same name (data isolation preserved).

---

## 🔧 Implementation Steps

### Step 1: Create Database Migration

Create a new Supabase migration file:

**File:** `supabase/migrations/[timestamp]_case_insensitive_client_names.sql`

```sql
-- ============================================================
-- Make Client Names Case-Insensitive for Uniqueness
-- ============================================================

-- Step 1: Drop existing unique constraint
ALTER TABLE public.clients 
  DROP CONSTRAINT IF EXISTS clients_user_id_name_key;

-- Step 2: Create case-insensitive unique index
-- LOWER() normalizes the name to lowercase for comparison
CREATE UNIQUE INDEX clients_user_id_name_lower_key 
  ON public.clients (user_id, LOWER(name));

-- Step 3: Add comment for documentation
COMMENT ON INDEX clients_user_id_name_lower_key IS 
  'Ensures client names are unique per user, case-insensitive';
```

**Why this works:**
- Uses `LOWER(name)` to normalize names before comparison
- "Acme Corp" → "acme corp"
- "ACME CORP" → "acme corp" 
- "acme corp" → "acme corp"
- All three map to same value, so only one can exist

---

### Step 2: Update Client Validation (Frontend)

Update validation to match the backend behavior and provide helpful error messages.

**File:** `src/domain/rules/ClientRules.ts`

Add a new validation method:

```typescript
/**
 * RULE 1B: Check for duplicate client names (case-insensitive)
 *
 * Business Logic: Client names must be unique per user, ignoring case
 *
 * @param name - The client name to check
 * @param userId - The user's ID
 * @param existingClients - All existing clients for this user
 * @param excludeClientId - Optional client ID to exclude (for updates)
 * @returns true if name is available, false if duplicate exists
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

  // ... rest of existing validation ...

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
```

---

### Step 3: Update ClientOrchestrator

Update the create and update workflows to pass existing clients for validation.

**File:** `src/services/orchestrators/ClientOrchestrator.ts`

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
  }
}
```

---

### Step 4: Handle Database Errors Gracefully

Update error handling to catch and display database constraint violations.

**File:** `src/services/orchestrators/ClientOrchestrator.ts`

In both `createClientWorkflow` and `updateClientWorkflow`, update the catch block:

```typescript
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
```

---

## 🧪 Testing Checklist

After implementation, test these scenarios:

### Manual Testing:
1. ✅ Create client "Acme Corp"
2. ❌ Try to create "ACME CORP" → Should show error
3. ❌ Try to create "acme corp" → Should show error  
4. ❌ Try to create "  Acme Corp  " (with spaces) → Should show error
5. ✅ Update "Acme Corp" to "Acme Corporation" → Should succeed
6. ❌ Update "Acme Corporation" to "ACME CORPORATION" if another client exists → Should show error
7. ✅ Different user can create "Acme Corp" → Should succeed (data isolation)

### Database Testing:
```sql
-- Test in Supabase SQL Editor
-- Should succeed
INSERT INTO clients (user_id, name, status) 
VALUES ('test-user-1', 'Test Client', 'active');

-- Should fail (case-insensitive duplicate)
INSERT INTO clients (user_id, name, status) 
VALUES ('test-user-1', 'TEST CLIENT', 'active');

-- Should succeed (different user)
INSERT INTO clients (user_id, name, status) 
VALUES ('test-user-2', 'Test Client', 'active');

-- Clean up
DELETE FROM clients WHERE user_id LIKE 'test-user%';
```

---

## 📊 Migration Safety

**Risk Level:** Low

**Why It's Safe:**
1. Uses `CREATE UNIQUE INDEX` instead of constraint (can be dropped/recreated easily)
2. Only affects new inserts/updates (existing data unchanged)
3. No data modification required
4. Can be rolled back if needed

**Rollback Plan:**
```sql
-- If you need to revert
DROP INDEX IF EXISTS clients_user_id_name_lower_key;

-- Restore original constraint
ALTER TABLE public.clients 
  ADD CONSTRAINT clients_user_id_name_key 
  UNIQUE (user_id, name);
```

**Before Running Migration:**
Check for existing duplicates that would violate the new constraint:

```sql
-- Find potential duplicates
SELECT 
  user_id, 
  LOWER(name) as normalized_name,
  array_agg(name) as variations,
  COUNT(*) as count
FROM clients
GROUP BY user_id, LOWER(name)
HAVING COUNT(*) > 1;
```

If duplicates exist, you'll need to manually merge or rename them before running the migration.

---

## 🔄 Alternative Approaches

### Option 2: Normalize on Insert (Store Lowercase)
**Pros:** Simpler queries, guaranteed consistency  
**Cons:** Loses original casing, requires data migration

```sql
-- Create normalized column
ALTER TABLE clients ADD COLUMN name_normalized TEXT;
UPDATE clients SET name_normalized = LOWER(name);
CREATE UNIQUE INDEX clients_user_id_name_normalized_key 
  ON clients (user_id, name_normalized);
```

**Verdict:** Not recommended - losing original casing is undesirable for display.

---

### Option 3: Case-Insensitive Collation
**Pros:** Database-native solution  
**Cons:** PostgreSQL collations are complex, locale-dependent

```sql
-- Would need to rebuild table with case-insensitive collation
-- More complex, not recommended for this use case
```

**Verdict:** Overkill for this requirement.

---

## ✅ Recommended Approach

**Use Option 1 (Unique Index on LOWER(name))**

Reasons:
- ✅ Preserves original casing for display
- ✅ Simple to implement and understand  
- ✅ No data migration required
- ✅ Easy to rollback if needed
- ✅ Standard PostgreSQL pattern

---

## 📚 Related Documentation

- **Database Migration**: `supabase/migrations/`
- **Business Logic**: `docs/core/App Logic.md` - Entity 2 (Client)
- **Domain Rules**: `src/domain/rules/ClientRules.ts`
- **Client Orchestrator**: `src/services/orchestrators/ClientOrchestrator.ts`

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

- This change only affects client name uniqueness checking
- Display names will still show in their original casing
- Labels and Groups may need similar treatment in the future
- Consider adding this pattern to other entities that need unique names
