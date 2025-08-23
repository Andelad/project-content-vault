-- Fix the function security issue with correct syntax
CREATE OR REPLACE FUNCTION public.hash_user_id(user_uuid UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encode(sha256((user_uuid::text || 'privacy_salt_2024')::bytea), 'hex');
$$;