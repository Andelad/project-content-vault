-- Fix the function security issue
CREATE OR REPLACE FUNCTION public.hash_user_id(user_uuid UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encode(digest(user_uuid::text || 'privacy_salt_2024', 'sha256'), 'hex');
$$;