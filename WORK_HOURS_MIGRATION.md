# Work Hours Database Migration Instructions

## For Lovable Platform

Run this SQL migration in your Supabase database:

```sql
-- Create work_hours table
CREATE TABLE work_hours (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start TIMESTAMPTZ NOT NULL,
    "end" TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS (Row Level Security)
ALTER TABLE work_hours ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view work hours" ON work_hours FOR SELECT USING (true);
CREATE POLICY "Anyone can insert work hours" ON work_hours FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update work hours" ON work_hours FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete work hours" ON work_hours FOR DELETE USING (true);

-- Add indexes for better performance
CREATE INDEX idx_work_hours_start ON work_hours(start);
CREATE INDEX idx_work_hours_end ON work_hours("end");
CREATE INDEX idx_work_hours_start_end ON work_hours(start, "end");

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_work_hours_updated_at BEFORE UPDATE ON work_hours
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Manual Setup

If you need to run this manually:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy and paste the above SQL
4. Click "Run"

## Type Generation

After running the migration, regenerate types:
```bash
npm run supabase:types
```

This will update the TypeScript types to include the work_hours table.
