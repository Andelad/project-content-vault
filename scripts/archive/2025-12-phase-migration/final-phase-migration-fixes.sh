#!/bin/bash

# Final targeted fixes for remaining Phase migration errors
# This handles the specific remaining issues from the build output

set -e

PROJECT_ROOT="/Users/andyjohnston/project-content-vault"
cd "$PROJECT_ROOT"

echo "🔧 Final Phase Migration Fixes"
echo "==============================="
echo ""

echo "Step 1: Fix duplicate PhaseDTO imports in ProjectContext.tsx"
echo "-------------------------------------------------------------"
# The file has PhaseDTO imported multiple times - need to consolidate

# We'll handle this manually as it requires careful editing

echo "Step 2: Fix 'Cannot find name milestones' errors"
echo "--------------------------------------------------"

# In files where 'milestones' variable doesn't exist but is referenced
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e 's/const isDeadlineDay = milestones\.some/const isDeadlineDay = phases.some/g' \
    -e 's/return milestones\.reduce/return phases.reduce/g' \
    -e 's/return milestones\.map/return phases.map/g' \
    {} \;

echo "Step 3: Fix 'Cannot find name m' in lambda expressions"
echo "--------------------------------------------------------"

# These are filter/map/some expressions where 'm' is used but 'p' is the parameter
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e 's/ m\.endDate / p.endDate /g' \
    -e 's/ m\.dueDate / p.dueDate /g' \
    -e 's/ m\.id / p.id /g' \
    -e 's/ m\.isRecurring / p.isRecurring /g' \
    -e 's/ m\.timeAllocation / p.timeAllocation /g' \
    -e 's/ m\.projectId / p.projectId /g' \
    -e 's/ m\.name / p.name /g' \
    -e 's/ m\.completed / p.completed /g' \
    -e 's/(m\./(p./g' \
    {} \;

echo "Step 4: Fix property name issues (milestones → phases)"
echo "-------------------------------------------------------"

# Fix usePhases return type
find src/hooks -type f -name "*.ts" -exec sed -i '' \
    -e 's/return {$/return {\n    phases,/g' \
    {} \;

# Fix property accesses
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
    -e 's/usePhases()\.milestones/usePhases().phases/g' \
    -e 's/context\.milestones/context.phases/g' \
    {} \;

echo "Step 5: Fix Milestone type references to PhaseDTO"
echo "---------------------------------------------------"

# Remaining Milestone → PhaseDTO conversions
find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/domain/entities/*" -exec sed -i '' \
    -e 's/: Milestone =/: PhaseDTO =/g' \
    -e 's/: Milestone;/: PhaseDTO;/g' \
    -e 's/: Milestone,/: PhaseDTO,/g' \
    -e 's/: Milestone)/: PhaseDTO)/g' \
    -e 's/Promise<Milestone/Promise<PhaseDTO/g' \
    {} \;

echo "Step 6: Fix interface/type definitions"
echo "----------------------------------------"

# Fix ProjectCreationWithMilestonesRequest to have phases property
sed -i '' 's/ProjectCreationWithMilestonesRequest/ProjectCreationWithPhasesRequest/g' \
    src/components/modals/ProjectModal.tsx 2>/dev/null || true

echo ""
echo "✅ Final fixes applied!"
echo ""
echo "Checking build status..."
npm run build 2>&1 | head -100
