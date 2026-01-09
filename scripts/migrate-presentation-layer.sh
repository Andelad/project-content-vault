#!/bin/bash

# Presentation Layer Migration Script
# Migrates "milestone" → "phase" terminology in presentation layer (hooks, contexts, components)
# Date: 2026-01-09

set -e  # Exit on error

echo "🚀 Starting Presentation Layer Migration..."
echo ""

# Files to process (organized by category)
HOOK_FILES=(
  "src/presentation/hooks/phase/usePhaseOperations.ts"
  "src/presentation/hooks/data/usePhases.ts"
  "src/presentation/hooks/phase/useRecurringPhases.ts"
  "src/presentation/hooks/phase/usePhaseBudget.ts"
  "src/presentation/hooks/timeline/usePhaseResize.ts"
)

CONTEXT_FILES=(
  "src/presentation/contexts/ProjectContext.tsx"
)

SERVICE_FILES=(
  "src/presentation/services/DragPositioning.ts"
  "src/presentation/services/DragCoordinator.ts"
)

COMPONENT_FILES=(
  "src/presentation/components/modals/ProjectModal.tsx"
  "src/presentation/components/features/project/ProjectPhaseSection.tsx"
  "src/presentation/components/debug/OrphanedPhasesCleaner.tsx"
  "src/presentation/components/modals/HelpModal.tsx"
  "src/presentation/components/features/timeline/ProjectBar.tsx"
  "src/presentation/components/views/TimelineView.tsx"
  "src/presentation/components/features/phases/MilestoneConfigDialog.tsx"
  "src/presentation/components/features/phases/PhaseConfigDialog.tsx"
  "src/presentation/components/features/phases/RecurringPhaseCard.tsx"
  "src/presentation/components/features/timeline/DraggablePhaseMarkers.tsx"
  "src/presentation/components/features/timeline/PhaseMarkers.tsx"
  "src/presentation/components/features/timeline/TimelineCard.tsx"
  "src/presentation/components/features/project/ProjectProgressGraph.tsx"
  "src/presentation/components/features/planner/EstimatedTimeCard.tsx"
  "src/presentation/components/views/PlannerView.tsx"
)

UTIL_FILES=(
  "src/presentation/utils/cleanupOrphanedMilestones.ts"
  "src/presentation/utils/dateFormatUtils.ts"
)

ALL_FILES=("${HOOK_FILES[@]}" "${CONTEXT_FILES[@]}" "${SERVICE_FILES[@]}" "${COMPONENT_FILES[@]}" "${UTIL_FILES[@]}")

for FILE in "${ALL_FILES[@]}"; do
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
  sed -i '' 's/milestone operations/phase operations/g' "$FILE"
  sed -i '' 's/Milestone operations/Phase operations/g' "$FILE"
  sed -i '' 's/milestone data/phase data/g' "$FILE"
  sed -i '' 's/Milestone data/Phase data/g' "$FILE"
  sed -i '' 's/milestone list/phase list/g' "$FILE"
  sed -i '' 's/Milestone list/Phase list/g' "$FILE"
  sed -i '' 's/milestone count/phase count/g' "$FILE"
  sed -i '' 's/Milestone count/Phase count/g' "$FILE"
  sed -i '' 's/milestone state/phase state/g' "$FILE"
  sed -i '' 's/Milestone state/Phase state/g' "$FILE"
  sed -i '' 's/milestone budget/phase budget/g' "$FILE"
  sed -i '' 's/Milestone budget/Phase budget/g' "$FILE"
  sed -i '' 's/milestone configuration/phase configuration/g' "$FILE"
  sed -i '' 's/Milestone configuration/Phase configuration/g' "$FILE"
  sed -i '' 's/milestone dialog/phase dialog/g' "$FILE"
  sed -i '' 's/Milestone dialog/Phase dialog/g' "$FILE"
  sed -i '' 's/milestone markers/phase markers/g' "$FILE"
  sed -i '' 's/Milestone markers/Phase markers/g' "$FILE"
  sed -i '' 's/milestone drag/phase drag/g' "$FILE"
  sed -i '' 's/Milestone drag/Phase drag/g' "$FILE"
  sed -i '' 's/recurring milestone/recurring phase/g' "$FILE"
  sed -i '' 's/Recurring milestone/Recurring phase/g' "$FILE"
  sed -i '' 's/orphaned milestone/orphaned phase/g' "$FILE"
  sed -i '' 's/Orphaned milestone/Orphaned phase/g' "$FILE"
  
  # Specific context comments
  sed -i '' 's/fetching milestones/fetching phases/g' "$FILE"
  sed -i '' 's/Fetching milestones/Fetching phases/g' "$FILE"
  sed -i '' 's/refetch milestones/refetch phases/g' "$FILE"
  sed -i '' 's/Refetch milestones/Refetch phases/g' "$FILE"
  sed -i '' 's/load milestones/load phases/g' "$FILE"
  sed -i '' 's/Load milestones/Load phases/g' "$FILE"
  sed -i '' 's/updating milestone/updating phase/g' "$FILE"
  sed -i '' 's/Updating milestone/Updating phase/g' "$FILE"
  sed -i '' 's/creating milestone/creating phase/g' "$FILE"
  sed -i '' 's/Creating milestone/Creating phase/g' "$FILE"
  sed -i '' 's/deleting milestone/deleting phase/g' "$FILE"
  sed -i '' 's/Deleting milestone/Deleting phase/g' "$FILE"
  sed -i '' 's/adding milestone/adding phase/g' "$FILE"
  sed -i '' 's/Adding milestone/Adding phase/g' "$FILE"
  sed -i '' 's/saving milestone/saving phase/g' "$FILE"
  sed -i '' 's/Saving milestone/Saving phase/g' "$FILE"
  
  # ============================================================================
  # FUNCTION NAMES
  # ============================================================================
  
  sed -i '' 's/fetchMilestones/fetchPhases/g' "$FILE"
  sed -i '' 's/refetchMilestones/refetchPhases/g' "$FILE"
  sed -i '' 's/addMilestone/addPhase/g' "$FILE"
  sed -i '' 's/updateMilestone/updatePhase/g' "$FILE"
  sed -i '' 's/deleteMilestone/deletePhase/g' "$FILE"
  sed -i '' 's/createMilestone/createPhase/g' "$FILE"
  sed -i '' 's/saveMilestone/savePhase/g' "$FILE"
  sed -i '' 's/handleMilestoneUpdate/handlePhaseUpdate/g' "$FILE"
  sed -i '' 's/handleMilestoneDelete/handlePhaseDelete/g' "$FILE"
  sed -i '' 's/handleMilestoneCreate/handlePhaseCreate/g' "$FILE"
  sed -i '' 's/onMilestoneUpdate/onPhaseUpdate/g' "$FILE"
  sed -i '' 's/onMilestoneDelete/onPhaseDelete/g' "$FILE"
  sed -i '' 's/onMilestoneCreate/onPhaseCreate/g' "$FILE"
  sed -i '' 's/cleanupOrphanedMilestones/cleanupOrphanedPhases/g' "$FILE"
  sed -i '' 's/normalizePhaseOrders/normalizePhaseOrders/g' "$FILE"
  
  # ============================================================================
  # VARIABLE NAMES
  # ============================================================================
  
  sed -i '' 's/milestoneId/phaseId/g' "$FILE"
  sed -i '' 's/milestones:/phases:/g' "$FILE"
  sed -i '' 's/milestones,/phases,/g' "$FILE"
  sed -i '' 's/milestones\./phases./g' "$FILE"
  sed -i '' 's/milestones\[/phases[/g' "$FILE"
  sed -i '' 's/milestones\?/phases?/g' "$FILE"
  sed -i '' 's/milestones =/phases =/g' "$FILE"
  sed -i '' 's/const milestones/const phases/g' "$FILE"
  sed -i '' 's/let milestones/let phases/g' "$FILE"
  sed -i '' 's/{ milestones }/{ phases }/g' "$FILE"
  sed -i '' 's/{ milestones,/{ phases,/g' "$FILE"
  sed -i '' 's/, milestones }/, phases }/g' "$FILE"
  sed -i '' 's/milestones: PhaseDTO/phases: PhaseDTO/g' "$FILE"
  sed -i '' 's/milestones: Phase\[\]/phases: Phase[]/g' "$FILE"
  
  # State variables
  sed -i '' 's/setMilestones/setPhases/g' "$FILE"
  sed -i '' 's/localMilestones/localPhases/g' "$FILE"
  sed -i '' 's/setLocalMilestones/setLocalPhases/g' "$FILE"
  sed -i '' 's/isMilestonesLoading/isPhasesLoading/g' "$FILE"
  sed -i '' 's/milestonesError/phasesError/g' "$FILE"
  sed -i '' 's/prevMilestones/prevPhases/g' "$FILE"
  
  # Props and parameters
  sed -i '' 's/milestone:/phase:/g' "$FILE"
  sed -i '' 's/milestone,/phase,/g' "$FILE"
  sed -i '' 's/milestone\./phase./g' "$FILE"
  sed -i '' 's/milestone\[/phase[/g' "$FILE"
  sed -i '' 's/milestone\?/phase?/g' "$FILE"
  sed -i '' 's/milestone =/phase =/g' "$FILE"
  sed -i '' 's/const milestone/const phase/g' "$FILE"
  sed -i '' 's/let milestone/let phase/g' "$FILE"
  sed -i '' 's/(milestone:/(phase:/g' "$FILE"
  sed -i '' 's/(milestone)/(phase)/g' "$FILE"
  sed -i '' 's/{ milestone }/{ phase }/g' "$FILE"
  sed -i '' 's/{ milestone,/{ phase,/g' "$FILE"
  sed -i '' 's/, milestone }/, phase }/g' "$FILE"
  
  # Loop variables
  sed -i '' 's/for (const milestone of/for (const phase of/g' "$FILE"
  sed -i '' 's/for (let milestone of/for (let phase of/g' "$FILE"
  sed -i '' 's/\.map((milestone)/\.map((phase)/g' "$FILE"
  sed -i '' 's/\.filter((milestone)/\.filter((phase)/g' "$FILE"
  sed -i '' 's/\.forEach((milestone)/\.forEach((phase)/g' "$FILE"
  sed -i '' 's/\.find((milestone)/\.find((phase)/g' "$FILE"
  sed -i '' 's/\.some((milestone)/\.some((phase)/g' "$FILE"
  sed -i '' 's/\.every((milestone)/\.every((phase)/g' "$FILE"
  
  # Object property access
  sed -i '' 's/milestoneData\./phaseData./g' "$FILE"
  sed -i '' 's/milestoneData:/phaseData:/g' "$FILE"
  sed -i '' 's/milestoneData,/phaseData,/g' "$FILE"
  sed -i '' 's/milestoneData)/phaseData)/g' "$FILE"
  sed -i '' 's/(milestoneData/(phaseData/g' "$FILE"
  sed -i '' 's/milestoneDate/phaseDate/g' "$FILE"
  
  # Action types and string literals
  sed -i '' "s/'move-milestone'/'move-phase'/g" "$FILE"
  sed -i '' 's/"move-milestone"/"move-phase"/g' "$FILE"
  
  # Specific comments that reference old terms
  sed -i '' "s/Database types still use 'milestones' key/Database table is now 'phases'/g" "$FILE"
  sed -i '' 's/phase == milestone/phase (formerly called milestone)/g' "$FILE"
  sed -i '' 's/legacy milestone terminology/legacy terminology/g' "$FILE"
  sed -i '' 's/fetch the milestone to check/fetch the phase to check/g' "$FILE"
  sed -i '' 's/delete the milestone itself/delete the phase itself/g' "$FILE"
  sed -i '' 's/other milestones (prevent/other phases (prevent/g' "$FILE"
  sed -i '' 's/original position of this phase/original position of this phase/g' "$FILE"
  
  # Compound variable names
  sed -i '' 's/milestoneWithId/phaseWithId/g' "$FILE"
  sed -i '' 's/MilestoneManager/PhaseManager/g' "$FILE"
  sed -i '' 's/handleMilestoneLocalValuesUpdate/handlePhaseLocalValuesUpdate/g' "$FILE"
  sed -i '' 's/recurringMilestoneInfo/recurringPhaseInfo/g' "$FILE"
  sed -i '' 's/newMilestone/newPhase/g' "$FILE"
  sed -i '' 's/currentMilestone/currentPhase/g' "$FILE"
  sed -i '' 's/updatedMilestone/updatedPhase/g' "$FILE"
  sed -i '' 's/deletedMilestone/deletedPhase/g' "$FILE"
  sed -i '' 's/savedMilestone/savedPhase/g' "$FILE"
  sed -i '' 's/existingMilestone/existingPhase/g' "$FILE"
  sed -i '' 's/targetMilestone/targetPhase/g' "$FILE"
  sed -i '' 's/contextMilestones/contextPhases/g' "$FILE"
  
  # Function parameter passing (watch for phase being passed but variable still called milestone)
  sed -i '' 's/addPhaseToContext(milestone /addPhaseToContext(phase /g' "$FILE"
  
  # More comments
  sed -i '' 's/Hook for managing milestone CRUD/Hook for managing phase CRUD/g' "$FILE"
  sed -i '' 's/Get all milestones for this project/Get all phases for this project/g' "$FILE"
  sed -i '' 's/Create a new milestone/Create a new phase/g' "$FILE"
  sed -i '' 's/Update an existing phase (legacy APIs still use milestone ids)/Update an existing phase/g' "$FILE"
  sed -i '' 's/Delete a phase (legacy APIs still use milestone ids)/Delete a phase/g' "$FILE"
  sed -i '' 's/Update phase property (delegates to orchestrator; legacy milestone ids supported)/Update phase property/g' "$FILE"
  sed -i '' 's/Milestone creation returned/Phase creation returned/g' "$FILE"
  
  # State variable names with "milestone" in them
  sed -i '' 's/milestonesAddedDuringSession/phasesAddedDuringSession/g' "$FILE"
  sed -i '' 's/trackedAddMilestone/trackedAddPhase/g' "$FILE"
  sed -i '' 's/setPhasesAddedDuringSession/setPhasesAddedDuringSession/g' "$FILE"
  
  # Comments about state and functionality
  sed -i '' 's/State for milestones in new projects/State for phases in new projects/g' "$FILE"
  sed -i '' 's/Track milestones added during/Track phases added during/g' "$FILE"
  sed -i '' 's/new milestone IDs/new phase IDs/g' "$FILE"
  sed -i '' 's/Track the new milestone ID/Track the new phase ID/g' "$FILE"
  sed -i '' 's/Clear local milestones/Clear local phases/g' "$FILE"
  sed -i '' 's/Reset milestones for/Reset phases for/g' "$FILE"
  sed -i '' 's/delete milestones added/delete phases added/g' "$FILE"
  
  # Database and backward compatibility notes
  sed -i '' "s/Database still uses 'milestones' table for backward compatibility/Database now uses 'phases' table/g" "$FILE"
  sed -i '' 's/All milestones are now phases/All items are now phases/g' "$FILE"
  
  # Display and filtering comments
  sed -i '' 's/Filter milestones for display/Filter phases for display/g' "$FILE"
  sed -i '' 's/Hide template milestone/Hide template phase/g' "$FILE"
  
  # User-facing text in Help and UI
  sed -i '' 's/events and milestones/events and phases/g' "$FILE"
  sed -i '' 's/all its events and milestones/all its events and phases/g' "$FILE"
  sed -i '' 's/Use milestones for/Use phases for/g' "$FILE"
  sed -i '' 's/Keep milestone titles/Keep phase titles/g' "$FILE"
  sed -i '' 's/warning if milestones exist/warning if phases exist/g' "$FILE"
  sed -i '' 's/initiating split (with warning if milestones/initiating split (with warning if phases/g' "$FILE"
  
  # Section IDs and HTML attributes
  sed -i '' 's/timeline-milestones/timeline-phases/g' "$FILE"
  sed -i '' 's/id="timeline-milestones"/id="timeline-phases"/g' "$FILE"
  
  # Capitalized in headings/titles
  sed -i '' 's/Milestones/Phases/g' "$FILE"
  
  # Comments about constraints and logic
  sed -i '' 's/Get relevant milestones/Get relevant phases/g' "$FILE"
  sed -i '' 's/Calculate disabled date ranges based on milestone constraints/Calculate disabled date ranges based on phase constraints/g' "$FILE"
  sed -i '' 's/No restrictions if no milestones/No restrictions if no phases/g' "$FILE"
  sed -i '' 's/cannot be on or after any milestone/cannot be on or after any phase/g' "$FILE"
  sed -i '' 's/cannot be on or before any milestone/cannot be on or before any phase/g' "$FILE"
  sed -i '' 's/before all milestones/before all phases/g' "$FILE"
  sed -i '' 's/after all milestones/after all phases/g' "$FILE"
  sed -i '' 's/Mark milestone dates/Mark phase dates/g' "$FILE"
  
  # Deleting and managing phases
  sed -i '' 's/Handle deleting existing milestones/Handle deleting existing phases/g' "$FILE"
  sed -i '' 's/Delete all milestones in parallel/Delete all phases in parallel/g' "$FILE"
  sed -i '' 's/Delete ALL phases\/milestones/Delete ALL phases/g' "$FILE"
  sed -i '' 's/all milestones are now phases/all items are now phases/g' "$FILE"
  
  # Validation messages
  sed -i '' 's/Validate milestone position/Validate phase position/g' "$FILE"
  sed -i '' 's/Milestone must be at least/Phase must be at least/g' "$FILE"
  sed -i '' 's/and other milestones/and other phases/g' "$FILE"
  
  # Historical notes - keep "(formerly called milestone)" but update others
  sed -i '' 's/phase (formerly called milestone))/phase (formerly: milestone))/g' "$FILE"
  
  # Type names and function names
  sed -i '' 's/UpdateMilestoneFn/UpdatePhaseFn/g' "$FILE"
  sed -i '' 's/initializeMilestoneDragState/initializePhaseDragState/g' "$FILE"
  sed -i '' 's/calculateMilestoneDragUpdate/calculatePhaseDragUpdate/g' "$FILE"
  sed -i '' 's/validateMilestoneBounds/validatePhaseBounds/g' "$FILE"
  sed -i '' 's/MilestoneBoundsValidation/PhaseBoundsValidation/g' "$FILE"
  sed -i '' 's/coordinateMilestoneDrag/coordinatePhaseDrag/g' "$FILE"
  sed -i '' 's/SupabaseMilestoneRow/SupabasePhaseRow/g' "$FILE"
  sed -i '' 's/SupabaseMilestoneInsert/SupabasePhaseInsert/g' "$FILE"
  
  # Variable names
  sed -i '' 's/dbAddMilestone/dbAddPhase/g' "$FILE"
  sed -i '' 's/dbUpdateMilestone/dbUpdatePhase/g' "$FILE"
  sed -i '' 's/dbDeleteMilestone/dbDeletePhase/g' "$FILE"
  sed -i '' 's/showMilestoneSuccessToast/showPhaseSuccessToast/g' "$FILE"
  sed -i '' 's/handleMilestoneDrag/handlePhaseDrag/g' "$FILE"
  sed -i '' 's/handleMilestoneDragEnd/handlePhaseDragEnd/g' "$FILE"
  sed -i '' 's/onMilestoneDrag/onPhaseDrag/g' "$FILE"
  sed -i '' 's/onMilestoneDragEnd/onPhaseDragEnd/g' "$FILE"
  sed -i '' 's/otherMilestoneDates/otherPhaseDates/g' "$FILE"
  sed -i '' 's/originalMilestoneDate/originalPhaseDate/g' "$FILE"
  sed -i '' 's/hasTemplateMilestone/hasTemplatePhase/g' "$FILE"
  
  # Error messages
  sed -i '' "s/Milestone due date is required/Phase due date is required/g" "$FILE"
  
  # Documentation references
  sed -i '' 's/ProjectMilestones\.tsx - Milestone indicators/ProjectPhases.tsx - Phase indicators/g' "$FILE"
  sed -i '' 's/ProjectMilestoneSection\.tsx - Milestone editor/ProjectPhaseSection.tsx - Phase editor/g' "$FILE"
  sed -i '' 's/ProjectMilestoneSection/ProjectPhaseSection/g' "$FILE"
  sed -i '' 's/Milestone bounds validation/Phase bounds validation/g' "$FILE"
  
  # Recurring phase patterns
  sed -i '' 's/Detect recurring pattern from existing milestones/Detect recurring pattern from existing phases/g' "$FILE"
  sed -i '' 's/if any NON-RECURRING milestones/if any NON-RECURRING phases/g' "$FILE"
  sed -i '' 's/First check for template milestone/First check for template phase/g' "$FILE"
  sed -i '' 's/The template milestone/The template phase/g' "$FILE"
  sed -i '' 's/recurring-milestone/recurring-phase/g' "$FILE"
  sed -i '' 's/templateMilestone/templatePhase/g' "$FILE"
  
  # Filtering and segments
  sed -i '' 's/Centralized filtered milestones/Centralized filtered phases/g' "$FILE"
  sed -i '' 's/filtered phases, not all milestones/filtered phases/g' "$FILE"
  sed -i '' 's/milestoneSegments/phaseSegments/g' "$FILE"
  sed -i '' 's/getMilestoneSegmentForDate/getPhaseSegmentForDate/g' "$FILE"
  sed -i '' "s/there's a milestone segment/there's a phase segment/g" "$FILE"
  
  # Drag handling
  sed -i '' 's/Handles milestone-specific drag/Handles phase-specific drag/g' "$FILE"
  sed -i '' 's/Use coordinatePhaseDrag\. Kept for backward compatibility with milestone terminology/Use coordinatePhaseDrag. Kept for backward compatibility/g' "$FILE"
  sed -i '' 's/Handle phase drag completion (legacy: milestone)/Handle phase drag completion/g' "$FILE"
  sed -i '' 's/Phases\/milestones use dueDate/Phases use dueDate/g' "$FILE"
  
  # Database notes and type references
  sed -i '' "s/Table renamed from 'milestones' to 'phases'/Table renamed to 'phases'/g" "$FILE"
  sed -i '' "s/'milestones' | /'phases' | /g" "$FILE"
  sed -i '' 's/milestonesLoading/phasesLoading/g' "$FILE"
  
  # HTML attributes
  sed -i '' 's/milestone-name/phase-name/g' "$FILE"
  
  # UI text
  sed -i '' 's/ milestones will be created/ phases will be created/g' "$FILE"
  
  # Comments about orphaned cleanup
  sed -i '' 's/These are milestones with:/These are phases with:/g' "$FILE"
  sed -i '' 's/no corresponding template milestone/no corresponding template phase/g' "$FILE"
  sed -i '' 's/Get all milestones for the project/Get all phases for the project/g' "$FILE"
  
  # Final comment patterns
  sed -i '' 's/Map of project ID to milestones/Map of project ID to phases/g' "$FILE"
  sed -i '' 's/milestones with startDate and endDate/phases with startDate and endDate/g' "$FILE"
  sed -i '' 's/Overdue milestones/Overdue phases/g' "$FILE"
  sed -i '' 's/milestone indicators/phase indicators/g' "$FILE"
  sed -i '' 's/Create milestones map/Create phases map/g' "$FILE"
  sed -i '' 's/normalized milestones from/normalized phases from/g' "$FILE"
  sed -i '' "s/Get all user's milestones/Get all user's phases/g" "$FILE"
  sed -i '' 's/Exclude temporary\/unsaved milestones/Exclude temporary\/unsaved phases/g' "$FILE"
  sed -i '' 's/Exclude NEW template milestones/Exclude NEW template phases/g' "$FILE"
  sed -i '' 's/for projects\/milestones/for projects\/phases/g' "$FILE"
  sed -i '' 's/(phase (formerly: milestone))/(phase)/g' "$FILE"
  sed -i '' 's/\/\/ milestoneStats\.logStats/\/\/ phaseStats.logStats/g' "$FILE"
  
  # ============================================================================
  # TYPE NAMES AND INTERFACES
  # ============================================================================
  
  sed -i '' 's/MilestoneData/PhaseData/g' "$FILE"
  sed -i '' 's/MilestoneProps/PhaseProps/g' "$FILE"
  sed -i '' 's/MilestoneState/PhaseState/g' "$FILE"
  sed -i '' 's/MilestoneConfig/PhaseConfig/g' "$FILE"
  sed -i '' 's/MilestoneInput/PhaseInput/g' "$FILE"
  sed -i '' 's/MilestoneUpdate/PhaseUpdate/g' "$FILE"
  sed -i '' 's/MilestoneCreate/PhaseCreate/g' "$FILE"
  sed -i '' 's/MilestoneDelete/PhaseDelete/g' "$FILE"
  sed -i '' 's/RecurringMilestone/RecurringPhase/g' "$FILE"
  sed -i '' 's/LocalMilestone/LocalPhase/g' "$FILE"
  
  # ============================================================================
  # EVENT NAMES
  # ============================================================================
  
  sed -i '' "s/'milestonesUpdated'/'phasesUpdated'/g" "$FILE"
  sed -i '' "s/'milestoneCreated'/'phaseCreated'/g" "$FILE"
  sed -i '' "s/'milestoneUpdated'/'phaseUpdated'/g" "$FILE"
  sed -i '' "s/'milestoneDeleted'/'phaseDeleted'/g" "$FILE"
  
  # ============================================================================
  # USER-FACING STRINGS AND ERROR MESSAGES
  # ============================================================================
  
  sed -i '' 's/Failed to fetch milestones/Failed to fetch phases/g' "$FILE"
  sed -i '' 's/Failed to load milestones/Failed to load phases/g' "$FILE"
  sed -i '' 's/Failed to update milestone/Failed to update phase/g' "$FILE"
  sed -i '' 's/Failed to delete milestone/Failed to delete phase/g' "$FILE"
  sed -i '' 's/Failed to create milestone/Failed to create phase/g' "$FILE"
  sed -i '' 's/Failed to save milestone/Failed to save phase/g' "$FILE"
  sed -i '' 's/Error fetching milestones/Error fetching phases/g' "$FILE"
  sed -i '' 's/Error loading milestones/Error loading phases/g' "$FILE"
  sed -i '' 's/Error updating milestone/Error updating phase/g' "$FILE"
  sed -i '' 's/Error deleting milestone/Error deleting phase/g' "$FILE"
  sed -i '' 's/Error creating milestone/Error creating phase/g' "$FILE"
  sed -i '' 's/Milestone updated successfully/Phase updated successfully/g' "$FILE"
  sed -i '' 's/Milestone deleted successfully/Phase deleted successfully/g' "$FILE"
  sed -i '' 's/Milestone created successfully/Phase created successfully/g' "$FILE"
  sed -i '' 's/Milestone saved successfully/Phase saved successfully/g' "$FILE"
  sed -i '' 's/No milestones found/No phases found/g' "$FILE"
  sed -i '' 's/Loading milestones/Loading phases/g' "$FILE"
  sed -i '' 's/Add Milestone/Add Phase/g' "$FILE"
  sed -i '' 's/Edit Milestone/Edit Phase/g' "$FILE"
  sed -i '' 's/Delete Milestone/Delete Phase/g' "$FILE"
  sed -i '' 's/New Milestone/New Phase/g' "$FILE"
  
  # Budget-related messages
  sed -i '' 's/Milestone budget/Phase budget/g' "$FILE"
  sed -i '' 's/milestone allocation/phase allocation/g' "$FILE"
  sed -i '' 's/Total milestone time/Total phase time/g' "$FILE"
  sed -i '' 's/milestone hours/phase hours/g' "$FILE"
  
  # Cleanup-specific messages
  sed -i '' 's/Orphaned Milestones/Orphaned Phases/g' "$FILE"
  sed -i '' 's/orphaned milestones/orphaned phases/g' "$FILE"
  sed -i '' 's/Cleanup Milestones/Cleanup Phases/g' "$FILE"
  sed -i '' 's/cleanup milestones/cleanup phases/g' "$FILE"
  
  # ============================================================================
  # FILE-SPECIFIC PATTERNS
  # ============================================================================
  
  # For MilestoneConfigDialog.tsx (component name)
  if [[ "$FILE" == *"MilestoneConfigDialog"* ]]; then
    sed -i '' 's/MilestoneConfigDialog/PhaseConfigDialog/g' "$FILE"
  fi
  
  # For cleanupOrphanedMilestones.ts (filename will be renamed separately)
  if [[ "$FILE" == *"cleanupOrphanedMilestones"* ]]; then
    sed -i '' 's/cleanupOrphanedMilestones/cleanupOrphanedPhases/g' "$FILE"
  fi
  
  echo "   ✅ Complete"
done

echo ""
echo "📊 Checking results..."
echo ""

# Count remaining references
TOTAL_REMAINING=0
for FILE in "${ALL_FILES[@]}"; do
  if [ -f "$FILE" ]; then
    COUNT=$(grep -o "milestone" "$FILE" | wc -l | tr -d ' ')
    if [ "$COUNT" -gt 0 ]; then
      echo "   $FILE: $COUNT remaining 'milestone' references"
      TOTAL_REMAINING=$((TOTAL_REMAINING + COUNT))
    fi
  fi
done

if [ "$TOTAL_REMAINING" -eq 0 ]; then
  echo "   ✅ All files clean! No milestone references remaining."
else
  echo ""
  echo "   Total: $TOTAL_REMAINING remaining 'milestone' references"
fi

echo ""
echo "✅ Presentation layer migration complete!"
echo ""
echo "📁 Files that may need manual renaming:"
echo "   - src/presentation/components/features/phases/MilestoneConfigDialog.tsx → PhaseConfigDialog.tsx (may already exist)"
echo "   - src/presentation/utils/cleanupOrphanedMilestones.ts → cleanupOrphanedPhases.ts"
echo ""
echo "Next steps:"
echo "1. Check compilation errors: npm run type-check (or check VS Code)"
echo "2. Review changes: git diff src/presentation/"
echo "3. Rename files if needed (check if target names don't already exist)"
echo "4. If needed, revert: git restore src/presentation/"
echo "5. Run tests when ready: npm test"
