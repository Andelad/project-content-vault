#!/bin/bash

# Rollback bad changes and apply proper fixes
# The first script incorrectly added "phase," to return statements
# This script rolls back those changes and applies only correct fixes

set -e

PROJECT_ROOT="/Users/andyjohnston/project-content-vault"
cd "$PROJECT_ROOT"

echo "🔄 Rolling back incorrect changes..."
echo "======================================"

# Step 1: Remove the incorrectly added "phase," from return statements
echo "Step 1: Removing incorrectly inserted 'phase,' from return statements"

find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e 's/return { phase,$/return {/g' \
    {} \;

echo "✅ Rollback complete"
echo ""

# Step 2: Now apply ONLY the correct fixes
echo "🔧 Applying correct fixes..."
echo "============================="

echo "Step 2a: Fix lambda parameter mismatches (p => m.property → p => p.property)"
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e 's/\.filter(p => m\./\.filter(p => p./g' \
    -e 's/\.map(p => m\./\.map(p => p./g' \
    -e 's/\.some(p => m\./\.some(p => p./g' \
    -e 's/\.every(p => m\./\.every(p => p./g' \
    -e 's/\.find(p => m\./\.find(p => p./g' \
    {} \;

echo "Step 2b: Fix Milestone type references to PhaseDTO (excluding domain entities)"
find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/domain/entities/*" -exec sed -i '' \
    -e 's/(milestone: Milestone)/(milestone: PhaseDTO)/g' \
    -e 's/(phase: Milestone)/(phase: PhaseDTO)/g' \
    -e 's/extends Milestone\>/extends PhaseDTO/g' \
    -e 's/<Milestone>/<PhaseDTO>/g' \
    -e 's/Map<string, Milestone\[\]>/Map<string, PhaseDTO[]>/g' \
    {} \;

echo "Step 2c: Fix project/request properties (milestones → phases)"
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e 's/project\.milestones\>/project.phases/g' \
    -e 's/request\.milestones\>/request.phases/g' \
    {} \;

echo "Step 2d: Fix forEach parameter names"
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e 's/phases\.forEach((milestone, /phases.forEach((phase, /g' \
    -e 's/phases\.forEach(milestone =>/phases.forEach(phase =>/g' \
    {} \;

echo ""
echo "✅ Fixes applied. Running build to check..."
echo ""

# Check results
if npm run build 2>&1 | head -50 | grep -q "Found 0 errors"; then
    echo "🎉 SUCCESS! All errors fixed!"
    exit 0
else
    echo "Remaining errors (showing first 50 lines):"
    npm run build 2>&1 | head -50
    exit 1
fi
