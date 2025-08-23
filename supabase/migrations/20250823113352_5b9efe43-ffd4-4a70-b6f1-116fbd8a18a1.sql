-- Fix security settings for better user data protection

-- Create a function to track anonymized usage events for future analytics
-- This stores only event types and timestamps, no user content
CREATE TABLE IF NOT EXISTS public.usage_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_hash TEXT NOT NULL, -- Hashed user ID for privacy
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}' -- Only non-sensitive metadata
);

-- Enable RLS on analytics table
ALTER TABLE public.usage_analytics ENABLE ROW LEVEL SECURITY;

-- Only allow system/admin access to analytics (no user access to analytics data)
CREATE POLICY "No user access to analytics" 
ON public.usage_analytics 
FOR ALL 
USING (false);

-- Create an index for efficient analytics queries
CREATE INDEX IF NOT EXISTS idx_usage_analytics_timestamp ON public.usage_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_event_type ON public.usage_analytics(event_type);

-- Add a privacy-compliant function to hash user IDs for analytics
CREATE OR REPLACE FUNCTION public.hash_user_id(user_uuid UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT encode(digest(user_uuid::text || 'privacy_salt_2024', 'sha256'), 'hex');
$$;