-- Remove the plaintext token columns from calendar_connections for security
ALTER TABLE public.calendar_connections 
DROP COLUMN IF EXISTS access_token,
DROP COLUMN IF EXISTS refresh_token,
DROP COLUMN IF EXISTS token_expires_at;

-- Add fields to track connection status without storing sensitive tokens
ALTER TABLE public.calendar_connections 
ADD COLUMN connection_status text DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'expired', 'error')),
ADD COLUMN last_auth_at timestamp with time zone,
ADD COLUMN auth_error_message text;

-- Update the RLS policies to ensure users can only access their own connections
-- (existing policies already handle this correctly)

-- Add a comment explaining the security change
COMMENT ON TABLE public.calendar_connections IS 'Calendar connections without stored OAuth tokens for security. Tokens are handled via secure edge functions only.';