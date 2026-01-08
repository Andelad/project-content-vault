#!/bin/bash

# Fix Phase Migration Parameter Name Mismatches
# This script fixes errors introduced by batch sed operations during Phase 9 migration
# Author: GitHub Copilot
# Date: 2025-12-29

set -e

PROJECT_ROOT="/Users/andyjohnston/project-content-vault"
cd "$PROJECT_ROOT"

echo "🔧 Phase Migration Error Fixer"
echo "================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for fixes
fix_count=0

# Function to fix a file with sed
fix_file() {
    local file="$1"
    local pattern="$2"
    local replacement="$3"
    local description="$4"
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${YELLOW}Fixing:${NC} $file - $description"
        sed -i '' "s/$pattern/$replacement/g" "$file"
        ((fix_count++))
    fi
}

echo "Step 1: Fix lambda parameter mismatches (p => m.property)"
echo "-----------------------------------------------------------"

# Pattern: p => m.something should be p => p.something
# This is the most common error from batch operations
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | while IFS= read -r -d '' file; do
    # Fix: .filter(p => m. → .filter(p => p.
    fix_file "$file" '\\.filter(p => m\\.' '.filter(p => p.' "filter lambda"
    
    # Fix: .map(p => m. → .map(p => p.
    fix_file "$file" '\\.map(p => m\\.' '.map(p => p.' "map lambda"
    
    # Fix: .some(p => m. → .some(p => p.
    fix_file "$file" '\\.some(p => m\\.' '.some(p => p.' "some lambda"
    
    # Fix: .every(p => m. → .every(p => p.
    fix_file "$file" '\\.every(p => m\\.' '.every(p => p.' "every lambda"
    
    # Fix: .find(p => m. → .find(p => p.
    fix_file "$file" '\\.find(p => m\\.' '.find(p => p.' "find lambda"
    
    # Fix: .reduce((total, milestone) => with milestone variable used in body
    sed -i '' 's/\\.reduce((total, milestone) =>/\.reduce((total, phase) =>/g' "$file" 2>/dev/null || true
done

echo ""
echo "Step 2: Fix variable name mismatches (milestones when parameter is phases)"
echo "--------------------------------------------------------------------------"

# Pattern: function foo(phases: Type[]) { ... milestones.something }
# We need to replace milestones with phases in function bodies

# This is more complex - we'll target specific known patterns
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | while IFS= read -r -d '' file; do
    # Fix: return milestones. → return phases. (when it's clearly wrong)
    sed -i '' 's/return milestones\\.filter/return phases.filter/g' "$file" 2>/dev/null || true
    sed -i '' 's/return milestones\\.map/return phases.map/g' "$file" 2>/dev/null || true
    sed -i '' 's/return milestones\\.reduce/return phases.reduce/g' "$file" 2>/dev/null || true
    sed -i '' 's/return milestones\\.some/return phases.some/g' "$file" 2>/dev/null || true
    sed -i '' 's/return milestones\\.sort/return phases.sort/g' "$file" 2>/dev/null || true
    
    # Fix: if (milestones. → if (phases.
    sed -i '' 's/if (milestones\\./if (phases./g' "$file" 2>/dev/null || true
    
    # Fix: const ... = milestones. → const ... = phases.
    sed -i '' 's/= milestones\\.filter/= phases.filter/g' "$file" 2>/dev/null || true
    sed -i '' 's/= milestones\\.map/= phases.map/g' "$file" 2>/dev/null || true
    sed -i '' 's/= milestones\\.reduce/= phases.reduce/g' "$file" 2>/dev/null || true
    sed -i '' 's/= milestones\\.some/= phases.some/g' "$file" 2>/dev/null || true
    sed -i '' 's/= milestones\\.every/= phases.every/g' "$file" 2>/dev/null || true
    sed -i '' 's/= milestones\\.find/= phases.find/g' "$file" 2>/dev/null || true
done

echo ""
echo "Step 3: Fix undefined variable references (milestone when it should exist)"
echo "--------------------------------------------------------------------------"

# Pattern: milestone.property when milestone variable doesn't exist
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | while IFS= read -r -d '' file; do
    # Fix common pattern: const date = milestone.endDate || milestone.dueDate
    # This appears in many places where the lambda parameter should be 'phase'
    sed -i '' 's/const milestoneDate = milestone\\.endDate || milestone\\.dueDate/const milestoneDate = phase.endDate || phase.dueDate/g' "$file" 2>/dev/null || true
    
    # Fix: const ... = milestone. (in contexts where phase is the parameter)
    sed -i '' 's/const timeAllocation = milestone\\.timeAllocationHours ?? milestone\\.timeAllocation/const timeAllocation = phase.timeAllocationHours ?? phase.timeAllocation/g' "$file" 2>/dev/null || true
    sed -i '' 's/const estimatedHours = milestone\\.timeAllocationHours ?? milestone\\.timeAllocation/const estimatedHours = phase.timeAllocationHours ?? phase.timeAllocation/g' "$file" 2>/dev/null || true
done

echo ""
echo "Step 4: Fix Milestone type references (should be PhaseDTO)"
echo "-----------------------------------------------------------"

find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/domain/entities/*" -print0 | while IFS= read -r -d '' file; do
    # Fix: extends Milestone → extends PhaseDTO
    sed -i '' 's/extends Milestone\\>/extends PhaseDTO/g' "$file" 2>/dev/null || true
    
    # Fix: : Milestone) → : PhaseDTO)
    sed -i '' 's/: Milestone)/: PhaseDTO)/g' "$file" 2>/dev/null || true
    
    # Fix: : Milestone, → : PhaseDTO,
    sed -i '' 's/: Milestone,/: PhaseDTO,/g' "$file" 2>/dev/null || true
    
    # Fix: : Milestone; → : PhaseDTO;
    sed -i '' 's/: Milestone;/: PhaseDTO;/g' "$file" 2>/dev/null || true
    
    # Fix: : Milestone | → : PhaseDTO |
    sed -i '' 's/: Milestone |/: PhaseDTO |/g' "$file" 2>/dev/null || true
    
    # Fix: <Milestone> → <PhaseDTO>
    sed -i '' 's/<Milestone>/<PhaseDTO>/g' "$file" 2>/dev/null || true
    
    # Fix: Map<string, Milestone[]> → Map<string, PhaseDTO[]>
    sed -i '' 's/Map<string, Milestone\[\]>/Map<string, PhaseDTO[]>/g' "$file" 2>/dev/null || true
    
    # Fix: Milestone[] → PhaseDTO[]
    sed -i '' 's/: Milestone\[\]/: PhaseDTO[]/g' "$file" 2>/dev/null || true
    sed -i '' 's/(Milestone\[\])/(PhaseDTO[])/g' "$file" 2>/dev/null || true
    
    # Fix: Milestone | → PhaseDTO |
    sed -i '' 's/(Milestone |/(PhaseDTO |/g' "$file" 2>/dev/null || true
done

echo ""
echo "Step 5: Fix specific import issues"
echo "-----------------------------------"

find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -path "*/domain/entities/*" -print0 | while IFS= read -r -d '' file; do
    # Ensure PhaseDTO is imported where needed
    if grep -q ": PhaseDTO" "$file" || grep -q "<PhaseDTO>" "$file" || grep -q "PhaseDTO\[\]" "$file"; then
        if ! grep -q "import.*PhaseDTO.*from.*@/types/core" "$file"; then
            # Check if there's already an import from @/types/core
            if grep -q "import.*from '@/types/core'" "$file"; then
                # Add PhaseDTO to existing import
                sed -i '' "s/import type { /import type { PhaseDTO, /g" "$file" 2>/dev/null || true
                sed -i '' "s/import { /import { PhaseDTO, /g" "$file" 2>/dev/null || true
            fi
        fi
    fi
done

echo ""
echo "Step 6: Fix Phase type references in domain rules (deprecated files)"
echo "--------------------------------------------------------------------"

# PhaseRulesDeprecated.ts should use PhaseDTO not Phase
if [ -f "src/domain/rules/PhaseRulesDeprecated.ts" ]; then
    sed -i '' 's/: Phase,/: PhaseDTO,/g' "src/domain/rules/PhaseRulesDeprecated.ts" 2>/dev/null || true
    sed -i '' 's/: Phase)/: PhaseDTO)/g' "src/domain/rules/PhaseRulesDeprecated.ts" 2>/dev/null || true
    sed -i '' 's/: Phase\[\]/: PhaseDTO[]/g' "src/domain/rules/PhaseRulesDeprecated.ts" 2>/dev/null || true
fi

echo ""
echo "Step 7: Fix shorthand property issues"
echo "--------------------------------------"

find src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | while IFS= read -r -d '' file; do
    # Fix: { milestone, ... } when milestone variable doesn't exist
    # Pattern: return { milestone, ... } should often be { phase, ... }
    # This is context-dependent, so we'll be conservative
    
    # Fix specific known patterns from error messages
    sed -i '' 's/return {$/return { phase,/g' "$file" 2>/dev/null || true
done

echo ""
echo "Step 8: Fix property access issues (milestones vs phases)"
echo "---------------------------------------------------------"

find src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | while IFS= read -r -d '' file; do
    # Fix: project.milestones → project.phases
    sed -i '' 's/project\\.milestones/project.phases/g' "$file" 2>/dev/null || true
    
    # Fix: request.milestones → request.phases
    sed -i '' 's/request\\.milestones/request.phases/g' "$file" 2>/dev/null || true
    
    # Fix: setMilestones → setPhases
    sed -i '' 's/\\.setMilestones(/\.setPhases(/g' "$file" 2>/dev/null || true
    
    # Fix: localPhasesState.setMilestones → localPhasesState.setPhases
    sed -i '' 's/localPhasesState\\.setMilestones/localPhasesState.setPhases/g' "$file" 2>/dev/null || true
done

echo ""
echo "Step 9: Fix lambda parameters in forEach/map/filter chains"
echo "----------------------------------------------------------"

find src -type f \( -name "*.ts" -o -name "*.tsx" \) -print0 | while IFS= read -r -d '' file; do
    # Fix: milestones.forEach((milestone, index) => when parameter renamed to phases
    sed -i '' 's/phases\\.forEach((milestone, /phases.forEach((phase, /g' "$file" 2>/dev/null || true
    sed -i '' 's/phases\\.forEach(milestone =>/phases.forEach(phase =>/g' "$file" 2>/dev/null || true
    
    # Fix: .map((m, idx) => when should be (phase, idx)
    sed -i '' 's/\\.map((m, idx) =>/\.map((phase, idx) =>/g' "$file" 2>/dev/null || true
done

echo ""
echo "Step 10: Verify and report"
echo "--------------------------"

# Run TypeScript compiler to check remaining errors
echo "Running TypeScript compiler to check for remaining errors..."
echo ""

if npm run build 2>&1 | tee /tmp/build-output.txt | grep -q "Found 0 errors"; then
    echo -e "${GREEN}✅ SUCCESS! All TypeScript errors fixed!${NC}"
    exit 0
else
    error_count=$(grep "Found.*errors" /tmp/build-output.txt | tail -1 || echo "unknown")
    echo -e "${YELLOW}⚠️  Remaining errors: $error_count${NC}"
    echo ""
    echo "Most common remaining errors:"
    grep "error TS" /tmp/build-output.txt | cut -d: -f3- | sort | uniq -c | sort -rn | head -10
    echo ""
    echo -e "${YELLOW}Note: Some errors may require manual fixes.${NC}"
    exit 1
fi
