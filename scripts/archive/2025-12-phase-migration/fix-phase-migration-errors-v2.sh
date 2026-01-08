#!/bin/bash

# Fix Phase Migration Parameter Name Mismatches - Version 2
# More careful approach to avoid creating new errors
# Author: GitHub Copilot
# Date: 2025-12-29

set -e

PROJECT_ROOT="/Users/andyjohnston/project-content-vault"
cd "$PROJECT_ROOT"

echo "🔧 Phase Migration Error Fixer V2"
echo "=================================="
echo ""

# Backup first
echo "Creating backup..."
git diff > /tmp/phase-migration-backup.patch 2>/dev/null || true

echo "Step 1: Fix obvious lambda parameter mismatches"
echo "-------------------------------------------------"

# Pattern: .method(p => m.something) should be .method(p => p.something)
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e 's/\.filter(p => m\./\.filter(p => p./g' \
    -e 's/\.map(p => m\./\.map(p => p./g' \
    -e 's/\.some(p => m\./\.some(p => p./g' \
    -e 's/\.every(p => m\./\.every(p => p./g' \
    -e 's/\.find(p => m\./\.find(p => p./g' \
    {} \;

echo "Step 2: Fix variable references in function bodies"
echo "---------------------------------------------------"

# More conservative - only fix clear cases
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e 's/\? milestones\.filter(p =>/?phases.filter(p =>/g' \
    -e 's/\? milestones\.some(p =>/?phases.some(p =>/g' \
    -e 's/\? milestones\.find(p =>/?phases.find(p =>/g' \
    -e 's/\? milestones\.every(p =>/?phases.every(p =>/g' \
    {} \;

echo "Step 3: Fix Milestone type to PhaseDTO"
echo "---------------------------------------"

find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/domain/entities/*" -exec sed -i '' \
    -e 's/extends Milestone\>/extends PhaseDTO/g' \
    -e 's/(milestone: Milestone)/(milestone: PhaseDTO)/g' \
    -e 's/(phase: Milestone)/(phase: PhaseDTO)/g' \
    -e 's/: Milestone\[\]/: PhaseDTO[]/g' \
    -e 's/<Milestone>/<PhaseDTO>/g' \
    -e 's/Map<string, Milestone\[\]>/Map<string, PhaseDTO[]>/g' \
    {} \;

echo "Step 4: Fix property names (milestones -> phases)"
echo "--------------------------------------------------"

find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e 's/project\.milestones/project.phases/g' \
    -e 's/request\.milestones/request.phases/g' \
    {} \;

echo "Step 5: Remove duplicate PhaseDTO imports"  
echo "------------------------------------------"

# This will be handled by the next manual pass

echo ""
echo "✅ V2 Script complete. Running build check..."

npm run build 2>&1 | head -100
