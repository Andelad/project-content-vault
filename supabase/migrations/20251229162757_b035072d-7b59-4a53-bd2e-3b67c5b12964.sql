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