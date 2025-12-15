-- Fix function search path for check_feedback_rate_limit
CREATE OR REPLACE FUNCTION public.check_feedback_rate_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  -- Check if user has submitted feedback in last minute
  IF EXISTS (
    SELECT 1 FROM feedback 
    WHERE user_id = NEW.user_id 
    AND created_at > NOW() - INTERVAL '1 minute'
  ) THEN
    RAISE EXCEPTION 'Please wait before submitting more feedback';
  END IF;
  
  -- Check if user has submitted more than 10 times today
  IF (
    SELECT COUNT(*) FROM feedback 
    WHERE user_id = NEW.user_id 
    AND created_at > NOW() - INTERVAL '1 day'
  ) >= 10 THEN
    RAISE EXCEPTION 'Daily feedback limit reached';
  END IF;
  
  RETURN NEW;
END;
$function$;