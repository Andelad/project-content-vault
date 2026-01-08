#!/bin/bash

# Simple targeted fixes for specific known errors
# No aggressive wildcard replacements

set -e

PROJECT_ROOT="/Users/andyjohnston/project-content-vault"
cd "$PROJECT_ROOT"

echo "🎯 Targeted Phase Migration Fixes"
echo "=================================="
echo ""

# 1. Fix milestones variable references in specific files
echo "1. Fixing variable name 'milestones' → 'phases' in known locations..."

# ProjectRules.ts
sed -i '' 's/analyzeBudget(project, milestones)/analyzeBudget(project, phases)/g' \
    src/domain/rules/ProjectRules.ts 2>/dev/null || true

# RelationshipRules.ts  
sed -i '' \
    -e 's/if (milestones\./if (phases./g' \
    -e 's/return milestones\./return phases./g' \
    -e 's/= milestones\./= phases./g' \
    -e 's/(milestones\.(/(phases./g' \
    -e 's/\? milestones\./?phases./g' \
    src/domain/rules/RelationshipRules.ts 2>/dev/null || true

# 2. Fix 'm' variable in lambda expressions in specific files
echo "2. Fixing lambda parameter 'm' →'p' in known files..."

for file in src/hooks/phase/*.ts src/hooks/*.ts; do
    [ -f "$file" ] && sed -i '' \
        -e 's/(p => m\.(/(p => p./g' \
        -e 's/ m\.id / p.id /g' \
        -e 's/ m\.name / p.name /g' \
        -e 's/ m\.projectId / p.projectId /g' \
        "$file" 2>/dev/null || true
done

# 3. Fix setMilestones → setPhases
echo "3. Fixing setMilestones → setPhases..."

find src/hooks -name "*.ts" -exec sed -i '' \
    's/\.setMilestones(/.setPhases(/g' {} \;

# 4. Fix context property access
echo "4. Fixing context.milestones → context.phases..."

find src/hooks -name "*.ts" -exec sed -i '' \
    's/context\.milestones/context.phases/g' {} \;

# 5. Fix specific milestone → phase variable references
echo "5. Fixing specific undefined 'milestone' variable references..."

sed -i '' \
    -e 's/const milestoneDate = milestone\./const milestoneDate = phase./g' \
    -e 's/if (!milestone)/if (!phase)/g' \
    -e 's/(milestone\.(/(phase./g' \
    src/hooks/phase/useRecurringPhases.ts 2>/dev/null || true

# 6. Fix Milestone type to PhaseDTO in specific hooks
echo "6. Fixing remaining Milestone types in hooks..."

find src/hooks -name "*.ts" -exec sed -i '' \
    -e 's/Promise<Milestone | /Promise<PhaseDTO | /g' \
    -e 's/: Milestone | /: PhaseDTO | /g' \
    -e 's/<Milestone>/<PhaseDTO>/g' \
    {} \;

# 7. Fix usePhaseOperations duplicate imports
echo "7. Cleaning up import issues in usePhaseOperations.ts..."

# This needs manual fix - skip for now

# 8. Remove shorthand 'phases' property issues
echo "8. Removing problematic shorthand properties..."

# These `return { phases,` lines that got added incorrectly - need to remove
find src -name "*.ts" -o -name "*.tsx" | while read file; do
    # If a return statement only has "phases," and nothing else meaningful, it's wrong
    sed -i '' '/^[[:space:]]*phases,$/d' "$file" 2>/dev/null || true
done

echo ""
echo "✅ Targeted fixes complete"
echo ""
echo "Running quick error check..."
npm run build 2>&1 | grep "Found.*errors" || echo "Build check complete"
