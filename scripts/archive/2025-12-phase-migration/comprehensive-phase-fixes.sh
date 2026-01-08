#!/bin/bash

# Comprehensive fix for remaining phase migration errors
# Targets common patterns across all remaining files

set -e

cd /Users/andyjohnston/project-content-vault

echo "🔧 Fixing remaining phase migration errors..."
echo "=============================================="

# Fix files with 'milestones' variable references
echo "1. Fixing 'milestones' → 'phases' variable references..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's/\bmilestones\.forEach(/phases.forEach(/g' \
  -e 's/\bmilestones\.map(/phases.map(/g' \
  -e 's/\bmilestones\.filter(/phases.filter(/g' \
  -e 's/\bmilestones\.some(/phases.some(/g' \
  -e 's/\bmilestones\.find(/phases.find(/g' \
  -e 's/\bmilestones\.reduce(/phases.reduce(/g' \
  -e 's/\bmilestones\.length/phases.length/g' \
  -e 's/= milestones\./= phases./g' \
  -e 's/return milestones\./return phases./g' \
  -e 's/if (milestones\./if (phases./g' \
  -e 's/const.*= milestones;/const phases = phases;/g' \
  {} \;

# Fix lambda parameter mismatches (m. → p.)
echo "2. Fixing lambda parameter 'm' → 'p'..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's/ m\.endDate/ p.endDate/g' \
  -e 's/ m\.dueDate/ p.dueDate/g' \
  -e 's/ m\.id/ p.id/g' \
  -e 's/ m\.name/ p.name/g' \
  -e 's/ m\.projectId/ p.projectId/g' \
  -e 's/ m\.project_id/ p.project_id/g' \
  -e 's/ m\.isRecurring/ p.isRecurring/g' \
  -e 's/ m\.is_recurring/ p.is_recurring/g' \
  -e 's/ m\.timeAllocation/ p.timeAllocation/g' \
  -e 's/ m\.time_allocation/ p.time_allocation/g' \
  -e 's/ m\.completed/ p.completed/g' \
  -e 's/(m\./(p./g' \
  -e 's/\[m\./(p./g' \
  {} \;

# Fix 'milestone' variable when it should be 'phase'
echo "3. Fixing 'milestone' → 'phase' variable references..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's/const milestoneDate = milestone\./const milestoneDate = phase./g' \
  -e 's/const timeAllocation = milestone\./const timeAllocation = phase./g' \
  -e 's/const estimatedHours = milestone\./const estimatedHours = phase./g' \
  -e 's/if (!milestone)/if (!phase)/g' \
  -e 's/if (milestone\./if (phase./g' \
  -e 's/milestone\.id &&/phase.id \&\&/g' \
  {} \;

# Fix Milestone type references
echo "4. Fixing 'Milestone' type → 'PhaseDTO'..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/domain/entities/*" -exec sed -i '' \
  -e 's/: Milestone\[\]/: PhaseDTO[]/g' \
  -e 's/<Milestone\[\]>/<PhaseDTO[]>/g' \
  -e 's/as Milestone\[\]/as PhaseDTO[]/g' \
  -e 's/<Milestone>/<PhaseDTO>/g' \
  -e 's/as Milestone>/as PhaseDTO>/g' \
  -e 's/Promise<Milestone/Promise<PhaseDTO/g' \
  -e 's/(milestone: Milestone)/(milestone: PhaseDTO)/g' \
  -e 's/(phase: Milestone)/(phase: PhaseDTO)/g' \
  -e 's/extends Milestone\>/extends PhaseDTO/g' \
  -e 's/<K extends keyof Milestone>/<K extends keyof PhaseDTO>/g' \
  {} \;

# Fix specific property/method access patterns
echo "5. Fixing property access patterns..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's/project\.milestones/project.phases/g' \
  -e 's/request\.milestones/request.phases/g' \
  -e 's/\.setMilestones(/.setPhases(/g' \
  {} \;

# Remove problematic duplicate shorthand properties
echo "6. Cleaning up..."
# This is handled manually for safety

echo ""
echo "✅ Batch fixes complete!"
echo ""
echo "Checking remaining errors..."
npm run build 2>&1 | grep "Found.*errors" || echo "Build check done"
