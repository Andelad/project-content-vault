# Database & System Migrations

This document contains SQL migrations and system migration instructions.

## 🗄️ Work Hours Table Migration

For setting up the work hours feature:

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

## 🧮 Calculation Services Migration

**Migration Summary**: All calculation logic has been moved from components to centralized services in `/src/services/`.

### Key Changes Made:

1. **Moved from components to services**: All math calculations now use memoized functions from `/src/services/`
2. **Eliminated duplication**: Single source of truth for each calculation type
3. **Added caching**: Automatic caching with `CalculationCacheService`
4. **Improved performance**: Memoized expensive calculations

### Services Created:

- **`ProjectCalculationService`**: Project metrics, time allocation, milestones
- **`TimelineCalculationService`**: UI positioning, viewport calculations  
- **`DateCalculationService`**: Date math, working days, holidays
- **`CalculationCacheService`**: Centralized caching for all calculations

### Migration Pattern:

```typescript
// OLD: Direct calculation in component
const totalHours = milestones.reduce((sum, m) => sum + m.hours, 0);

// NEW: Use service with caching
import { calculateMilestoneMetrics } from '@/services';
const metrics = calculateMilestoneMetrics(milestones, projectBudget);
```

### Benefits Achieved:

✅ **No duplication**: Single calculation per business rule  
✅ **Automatic caching**: Better performance with memoization  
✅ **Testable**: Calculations can be unit tested in isolation  
✅ **Maintainable**: Changes to calculations happen in one place  
✅ **Type-safe**: Full TypeScript support for all calculations  

For complete migration details, see the architectural rules in `/docs/architecture/ARCHITECTURAL_RULES.md`.
