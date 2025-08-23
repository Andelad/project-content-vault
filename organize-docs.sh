#!/bin/bash

# Script to organize markdown documentation files into proper folders
echo "Organizing documentation files..."

# Create directory structure if it doesn't exist
mkdir -p docs/architecture
mkdir -p docs/migrations  
mkdir -p docs/development
mkdir -p docs/loveable

# Move migration-related files
echo "Moving migration files..."
[ -f "CALCULATION_SERVICES_MIGRATION.md" ] && mv CALCULATION_SERVICES_MIGRATION.md docs/migrations/
[ -f "WORK_HOURS_MIGRATION.md" ] && mv WORK_HOURS_MIGRATION.md docs/migrations/

# Move development/process files
echo "Moving development files..."
[ -f "PRE_CHANGE_CHECKLIST.md" ] && mv PRE_CHANGE_CHECKLIST.md docs/development/
[ -f "VERSION_TRACKING.md" ] && mv VERSION_TRACKING.md docs/development/
[ -f "VIOLATIONS_FIXED.md" ] && mv VIOLATIONS_FIXED.md docs/development/
[ -f "TOAST_DEBOUNCE_SOLUTION.md" ] && mv TOAST_DEBOUNCE_SOLUTION.md docs/development/
[ -f "performance-improvements.md" ] && mv performance-improvements.md docs/development/

# Move Loveable-specific files
echo "Moving Loveable files..."
[ -f "LOVEABLE_BATCH_INSTRUCTIONS.md" ] && mv LOVEABLE_BATCH_INSTRUCTIONS.md docs/loveable/
[ -f "LOVEABLE_MILESTONE_HOURS_UPDATE.md" ] && mv LOVEABLE_MILESTONE_HOURS_UPDATE.md docs/loveable/
[ -f "LOVEABLE_MILESTONE_INSTRUCTIONS.md" ] && mv LOVEABLE_MILESTONE_INSTRUCTIONS.md docs/loveable/

# Move architecture/infrastructure files
echo "Moving architecture files..."
[ -f "SUPABASE_REQUIREMENTS.md" ] && mv SUPABASE_REQUIREMENTS.md docs/architecture/

# Move guidelines folder content to docs if it exists
if [ -d "guidelines" ]; then
    echo "Moving guidelines..."
    mv guidelines docs/
fi

echo "Creating documentation index..."
cat > docs/README.md << 'EOF'
# Project Documentation

This directory contains all project documentation organized by category.

## Directory Structure

### 📁 `architecture/`
System architecture, design decisions, and technical specifications:
- `COLOR_SYSTEM_SUMMARY.md` - Color system consolidation and design
- `CALENDAR_COLOR_IMPROVEMENTS.md` - Calendar UI color enhancements
- `SUPABASE_REQUIREMENTS.md` - Database and backend requirements

### 📁 `migrations/`
Database and system migration documentation:
- `CALCULATION_SERVICES_MIGRATION.md` - Services migration guide
- `WORK_HOURS_MIGRATION.md` - Work hours system migration

### 📁 `development/`
Development processes, fixes, and improvements:
- `PRE_CHANGE_CHECKLIST.md` - Pre-deployment checklist
- `VERSION_TRACKING.md` - Version control and tracking
- `VIOLATIONS_FIXED.md` - Code violation fixes
- `TOAST_DEBOUNCE_SOLUTION.md` - UI toast debouncing solution
- `performance-improvements.md` - Performance optimization notes

### 📁 `loveable/`
Loveable platform-specific instructions and processes:
- `LOVEABLE_BATCH_INSTRUCTIONS.md` - Batch operation instructions
- `LOVEABLE_MILESTONE_HOURS_UPDATE.md` - Milestone hours update process
- `LOVEABLE_MILESTONE_INSTRUCTIONS.md` - General milestone instructions

### 📁 `guidelines/`
Development guidelines and coding standards:
- `Guidelines.md` - General development guidelines

## Quick Navigation

- [Architecture Overview](./architecture/)
- [Migration Guides](./migrations/)
- [Development Process](./development/)
- [Loveable Platform](./loveable/)
- [Coding Guidelines](./guidelines/)

---

*Last updated: August 2025*
EOF

echo "Documentation organization complete!"
echo ""
echo "Summary:"
echo "✅ Created organized directory structure in docs/"
echo "✅ Moved architecture files to docs/architecture/"
echo "✅ Moved migration files to docs/migrations/"
echo "✅ Moved development files to docs/development/"
echo "✅ Moved Loveable files to docs/loveable/"
echo "✅ Moved guidelines to docs/guidelines/"
echo "✅ Created comprehensive docs/README.md index"
echo ""
echo "The root directory is now clean with only essential files!"
