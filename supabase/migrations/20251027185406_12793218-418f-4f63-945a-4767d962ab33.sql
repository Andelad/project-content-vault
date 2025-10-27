-- Create feedback table
CREATE TABLE feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_context text NOT NULL CHECK (usage_context IN ('university', 'work', 'personal')),
  feedback_type text NOT NULL CHECK (feedback_type IN ('like', 'dislike', 'bug', 'feature')),
  feedback_text text NOT NULL,
  user_email text,
  created_at timestamptz DEFAULT now(),
  status text DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'archived')),
  
  -- Metadata
  user_agent text,
  url text
);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
  ON feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
  ON feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Add index for better query performance
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- Create storage bucket for feedback attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-attachments', 'feedback-attachments', false);

-- Storage policy: Users can upload their own feedback attachments
CREATE POLICY "Users can upload feedback attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policy: Users can view their own feedback attachments
CREATE POLICY "Users can view their own feedback attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create feedback_attachments table
CREATE TABLE feedback_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id uuid REFERENCES feedback(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE feedback_attachments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view attachments for their feedback
CREATE POLICY "Users can view their feedback attachments"
  ON feedback_attachments
  FOR SELECT
  TO authenticated
  USING (
    feedback_id IN (
      SELECT id FROM feedback WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert attachments for their feedback
CREATE POLICY "Users can insert their feedback attachments"
  ON feedback_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    feedback_id IN (
      SELECT id FROM feedback WHERE user_id = auth.uid()
    )
  );

-- Add rate limiting check function
CREATE OR REPLACE FUNCTION check_feedback_rate_limit()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Apply trigger
CREATE TRIGGER feedback_rate_limit
  BEFORE INSERT ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION check_feedback_rate_limit();