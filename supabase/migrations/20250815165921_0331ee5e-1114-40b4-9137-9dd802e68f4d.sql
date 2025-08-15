-- First, create a secure vault secret for token encryption
INSERT INTO vault.secrets (name, secret) 
VALUES ('calendar_token_encryption_key', gen_random_bytes(32));

-- Remove the plaintext token columns from calendar_connections
ALTER TABLE public.calendar_connections 
DROP COLUMN IF EXISTS access_token,
DROP COLUMN IF EXISTS refresh_token;

-- Add encrypted token reference column
ALTER TABLE public.calendar_connections 
ADD COLUMN encrypted_token_id uuid REFERENCES vault.secrets(id);

-- Create a security definer function to handle token encryption/decryption
CREATE OR REPLACE FUNCTION public.store_calendar_tokens(
  connection_id uuid,
  access_token text,
  refresh_token text DEFAULT NULL
) 
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  token_data jsonb;
  encrypted_token_secret_id uuid;
BEGIN
  -- Prepare token data as JSON
  token_data := jsonb_build_object(
    'access_token', access_token,
    'refresh_token', refresh_token,
    'created_at', now()
  );
  
  -- Store encrypted tokens in vault
  INSERT INTO vault.secrets (name, secret, description)
  VALUES (
    'calendar_tokens_' || connection_id::text,
    token_data::text,
    'Encrypted OAuth tokens for calendar connection'
  )
  RETURNING id INTO encrypted_token_secret_id;
  
  -- Update calendar connection with reference to encrypted tokens
  UPDATE public.calendar_connections 
  SET encrypted_token_id = encrypted_token_secret_id
  WHERE id = connection_id;
  
  RETURN encrypted_token_secret_id;
END;
$$;

-- Create function to retrieve decrypted tokens (only for authorized operations)
CREATE OR REPLACE FUNCTION public.get_calendar_tokens(connection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  token_secret_id uuid;
  decrypted_tokens text;
BEGIN
  -- Verify user owns this connection
  SELECT encrypted_token_id INTO token_secret_id
  FROM public.calendar_connections
  WHERE id = connection_id AND user_id = auth.uid();
  
  IF token_secret_id IS NULL THEN
    RAISE EXCEPTION 'Connection not found or access denied';
  END IF;
  
  -- Retrieve decrypted tokens
  SELECT decrypted_secret INTO decrypted_tokens
  FROM vault.decrypted_secrets
  WHERE id = token_secret_id;
  
  RETURN decrypted_tokens::jsonb;
END;
$$;

-- Create function to update tokens securely
CREATE OR REPLACE FUNCTION public.update_calendar_tokens(
  connection_id uuid,
  access_token text,
  refresh_token text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  token_secret_id uuid;
  token_data jsonb;
BEGIN
  -- Verify user owns this connection
  SELECT encrypted_token_id INTO token_secret_id
  FROM public.calendar_connections
  WHERE id = connection_id AND user_id = auth.uid();
  
  IF token_secret_id IS NULL THEN
    RAISE EXCEPTION 'Connection not found or access denied';
  END IF;
  
  -- Prepare updated token data
  token_data := jsonb_build_object(
    'access_token', access_token,
    'refresh_token', refresh_token,
    'updated_at', now()
  );
  
  -- Update encrypted tokens in vault
  UPDATE vault.secrets 
  SET secret = token_data::text
  WHERE id = token_secret_id;
END;
$$;

-- Create function to safely delete tokens
CREATE OR REPLACE FUNCTION public.delete_calendar_tokens(connection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  token_secret_id uuid;
BEGIN
  -- Verify user owns this connection
  SELECT encrypted_token_id INTO token_secret_id
  FROM public.calendar_connections
  WHERE id = connection_id AND user_id = auth.uid();
  
  IF token_secret_id IS NULL THEN
    RETURN; -- Nothing to delete or no permission
  END IF;
  
  -- Delete encrypted tokens from vault
  DELETE FROM vault.secrets WHERE id = token_secret_id;
  
  -- Clear reference in calendar_connections
  UPDATE public.calendar_connections 
  SET encrypted_token_id = NULL
  WHERE id = connection_id;
END;
$$;

-- Create trigger to automatically clean up tokens when connection is deleted
CREATE OR REPLACE FUNCTION public.cleanup_calendar_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  IF OLD.encrypted_token_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = OLD.encrypted_token_id;
  END IF;
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER cleanup_calendar_tokens_trigger
  BEFORE DELETE ON public.calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_calendar_tokens();