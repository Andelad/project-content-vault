#!/bin/bash

# Application Layer Migration Script
# Migrates "milestone" → "phase" terminology in application orchestrators
# Date: 2026-01-09

set -e  # Exit on error

echo "🚀 Starting Application Layer Migration..."
echo ""

# Files to process
FILES=(
  "src/application/orchestrators/PhaseOrchestrator.ts"
  "src/application/orchestrators/ProjectOrchestrator.ts"
)

for FILE in "${FILES[@]}"; do
  if [ ! -f "$FILE" ]; then
    echo "⚠️  File not found: $FILE"
    continue
  fi
  
  echo "📝 Processing $FILE..."
  
  # ============================================================================
  # COMMENTS AND DOCUMENTATION
  # ============================================================================
  
  sed -i '' 's/milestone management/phase management/g' "$FILE"
  sed -i '' 's/Milestone management/Phase management/g' "$FILE"
  sed -i '' 's/project-milestone/project-phase/g' "$FILE"
  sed -i '' 's/Project-milestone/Project-phase/g' "$FILE"
  sed -i '' 's/Coordinated project-milestone/Coordinated project-phase/g' "$FILE"
  sed -i '' 's/Handles project business workflows and project-milestone/Handles project business workflows and project-phase/g' "$FILE"
  sed -i '' 's/Analyze project-milestone relationship/Analyze project-phase relationship/g' "$FILE"
  sed -i '' 's/Calculate project budget adjustments needed for milestone compatibility/Calculate project budget adjustments needed for phase compatibility/g' "$FILE"
  sed -i '' 's/Check for milestone date conflicts/Check for phase date conflicts/g' "$FILE"
  
  # Comments about template phases
  sed -i '' 's/template milestone/template phase/g' "$FILE"
  sed -i '' 's/Template milestone/Template phase/g' "$FILE"
  sed -i '' 's/TEMPLATE milestone/TEMPLATE phase/g' "$FILE"
  
  # Validation and constraints comments
  sed -i '' 's/Validate project timeframe with milestone constraints/Validate project timeframe with phase constraints/g' "$FILE"
  sed -i '' 's/Validate each milestone fits within project bounds/Validate each phase fits within project bounds/g' "$FILE"
  sed -i '' 's/Validate milestone scheduling within project context/Validate phase scheduling within project context/g' "$FILE"
  sed -i '' 's/Verify milestone fits within project timeframe/Verify phase fits within project timeframe/g' "$FILE"
  sed -i '' 's/Check for date conflicts with existing milestones/Check for date conflicts with existing phases/g' "$FILE"
  sed -i '' 's/Check milestone date compatibility/Check phase date compatibility/g' "$FILE"
  
  # Descriptive comments
  sed -i '' 's/existing milestones/existing phases/g' "$FILE"
  sed -i '' 's/Create a SINGLE template milestone/Create a SINGLE template phase/g' "$FILE"
  sed -i '' 's/Create the TEMPLATE milestone/Create the TEMPLATE phase/g' "$FILE"
  sed -i '' 's/Insert the template milestone/Insert the template phase/g' "$FILE"
  sed -i '' 's/Create recurring milestone object/Create recurring phase object/g' "$FILE"
  sed -i '' 's/One template milestone created/One template phase created/g' "$FILE"
  sed -i '' 's/Deletes the single template milestone/Deletes the single template phase/g' "$FILE"
  sed -i '' 's/Find template milestone with/Find template phase with/g' "$FILE"
  sed -i '' 's/Delete milestones from database/Delete phases from database/g' "$FILE"
  sed -i '' 's/Calculate estimated milestone count/Calculate estimated phase count/g' "$FILE"
  sed -i '' 's/we now use single template milestone/we now use single template phase/g' "$FILE"
  
  # Budget and allocation comments
  sed -i '' 's/over-budget milestones/over-budget phases/g' "$FILE"
  sed -i '' 's/adding milestones/adding phases/g' "$FILE"
  sed -i '' 's/adding more milestones/adding more phases/g' "$FILE"
  sed -i '' 's/reducing milestone allocations/reducing phase allocations/g' "$FILE"
  sed -i '' 's/milestone date conflicts/phase date conflicts/g' "$FILE"
  
  # Error messages
  sed -i '' 's/milestone(s) would fall outside/phase(s) would fall outside/g' "$FILE"
  
  # ============================================================================
  # TYPE NAMES AND INTERFACES
  # ============================================================================
  
  sed -i '' 's/ProjectMilestone/ProjectPhase/g' "$FILE"
  sed -i '' 's/GeneratedMilestone/GeneratedPhase/g' "$FILE"
  sed -i '' 's/MilestoneOrchestrationOptions/PhaseOrchestrationOptions/g' "$FILE"
  sed -i '' 's/MilestoneDraft/PhaseDraft/g' "$FILE"
  sed -i '' 's/MilestoneCreatePayload/PhaseCreatePayload/g' "$FILE"
  sed -i '' 's/MilestoneUpdatePayload/PhaseUpdatePayload/g' "$FILE"
  sed -i '' 's/ProjectMilestoneAnalysis/ProjectPhaseAnalysis/g' "$FILE"
  sed -i '' 's/ProjectCreationWithMilestonesRequest/ProjectCreationWithPhasesRequest/g' "$FILE"
  sed -i '' 's/ProjectMilestoneCreateInput/ProjectPhaseCreateInput/g' "$FILE"
  
  # ============================================================================
  # FUNCTION NAMES
  # ============================================================================
  
  sed -i '' 's/validateMilestoneScheduling/validatePhaseScheduling/g' "$FILE"
  sed -i '' 's/analyzeProjectMilestones/analyzeProjectPhases/g' "$FILE"
  sed -i '' 's/checkMilestoneDateConflicts/checkPhaseDateConflicts/g' "$FILE"
  sed -i '' 's/createProjectMilestones/createProjectPhases/g' "$FILE"
  
  # ============================================================================
  # VARIABLE NAMES AND PARAMETERS
  # ============================================================================
  
  # Function parameters
  sed -i '' 's/    milestone: Partial<PhaseDTO>,/    phase: Partial<PhaseDTO>,/g' "$FILE"
  sed -i '' 's/milestone\./phase./g' "$FILE"
  sed -i '' 's/      milestone,/      phase,/g' "$FILE"
  sed -i '' 's/milestones?:/phases?:/g' "$FILE"
  
  # Variable declarations and assignments
  sed -i '' 's/milestoneCount/phaseCount/g' "$FILE"
  sed -i '' 's/incompatibleMilestones/incompatiblePhases/g' "$FILE"
  sed -i '' 's/existingPhases - Optional existing milestones/existingPhases - Optional existing phases/g' "$FILE"
  sed -i '' 's/milestoneId/phaseId/g' "$FILE"
  sed -i '' 's/localMilestone/localPhase/g' "$FILE"
  sed -i '' "s/'milestonesUpdated'/'phasesUpdated'/g" "$FILE"
  
  # Error messages and user-facing strings
  sed -i '' 's/Refetch milestones/Refetch phases/g' "$FILE"
  sed -i '' 's/Delete a single milestone by ID/Delete a single phase by ID/g' "$FILE"
  sed -i '' 's/Error deleting milestone/Error deleting phase/g' "$FILE"
  sed -i '' 's/Update milestone property/Update phase property/g' "$FILE"
  sed -i '' 's/Cannot save milestone/Cannot save phase/g' "$FILE"
  sed -i '' 's/Total milestone allocation/Total phase allocation/g' "$FILE"
  sed -i '' 's/Budget validation for new milestones/Budget validation for new phases/g' "$FILE"
  sed -i '' 's/new milestone that needs/new phase that needs/g' "$FILE"
  sed -i '' 's/Normalize milestone orders/Normalize phase orders/g' "$FILE"
  
  # JSDoc and function descriptions
  sed -i '' 's/milestone type counting/phase type counting/g' "$FILE"
  sed -i '' 's/Execute complete project creation workflow with milestones/Execute complete project creation workflow with phases/g' "$FILE"
  sed -i '' 's/Complete project creation request including optional milestones/Complete project creation request including optional phases/g' "$FILE"
  sed -i '' 's/Handle milestone creation/Handle phase creation/g' "$FILE"
  sed -i '' 's/Create milestones for a project/Create phases for a project/g' "$FILE"
  sed -i '' 's/Failed to save milestone/Failed to save phase/g' "$FILE"
  sed -i '' 's/Continue with other milestones/Continue with other phases/g' "$FILE"
  sed -i '' 's/Update request milestones/Update request phases/g' "$FILE"
  sed -i '' 's/individual milestone toasts/individual phase toasts/g' "$FILE"
  sed -i '' 's/milestone(s) and/phase(s) and/g' "$FILE"
  
  # Function parameter names (with type annotations)
  sed -i '' 's/(milestone: Partial<PhaseDTO>)/(phase: Partial<PhaseDTO>)/g' "$FILE"
  sed -i '' 's/(milestone: RecurringPhase)/(phase: RecurringPhase)/g' "$FILE"
  sed -i '' 's/(milestone: PhaseCreatePayload)/(phase: PhaseCreatePayload)/g' "$FILE"
  sed -i '' 's/addPhase: (milestone:/addPhase: (phase:/g' "$FILE"
  sed -i '' 's/setRecurringPhase: (milestone:/setRecurringPhase: (phase:/g' "$FILE"
  
  # Index variables
  sed -i '' 's/milestoneIndex/phaseIndex/g' "$FILE"
  
  # Inline comments and error messages
  sed -i '' 's/Save the new milestone/Save the new phase/g' "$FILE"
  sed -i '' 's/Update recurring milestone load/Update recurring phase load/g' "$FILE"
  sed -i '' 's/Failed to update recurring milestone load/Failed to update recurring phase load/g' "$FILE"
  sed -i '' 's/Save new milestone with validation/Save new phase with validation/g' "$FILE"
  sed -i '' 's/Update the template recurring milestone/Update the template recurring phase/g' "$FILE"
  sed -i '' 's/Simulate adding the new milestone/Simulate adding the new phase/g' "$FILE"
  sed -i '' 's/Validate milestone before saving/Validate phase before saving/g' "$FILE"
  sed -i '' 's/check if adding this milestone/check if adding this phase/g' "$FILE"
  sed -i '' 's/Adding this milestone would exceed/Adding this phase would exceed/g' "$FILE"
  sed -i '' 's/Failed to save new milestone/Failed to save new phase/g' "$FILE"
  
  # JSDoc example code
  sed -i '' 's/milestones: \[/phases: [/g' "$FILE"
  sed -i '' 's/milestones: ProjectPhase\[\]/phases: ProjectPhase[]/g' "$FILE"
  sed -i '' 's/for (const phase of milestones)/for (const phase of phases)/g' "$FILE"
  
  # ============================================================================
  # IMPORT STATEMENTS
  # ============================================================================
  
  sed -i '' 's/import { validateMilestoneScheduling }/import { validatePhaseScheduling }/g' "$FILE"
  
  echo "   ✅ Complete"
done

echo ""
echo "📊 Checking results..."
echo ""

for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    COUNT=$(grep -o "milestone" "$FILE" | wc -l | tr -d ' ')
    echo "   $FILE: $COUNT remaining 'milestone' references"
  fi
done

echo ""
echo "✅ Application layer migration complete!"
echo ""
echo "Next steps:"
echo "1. Check compilation errors: npm run type-check (or check VS Code)"
echo "2. Review changes: git diff src/application/orchestrators/"
echo "3. If needed, revert: git restore src/application/orchestrators/"
echo "4. Run tests when ready: npm test"
