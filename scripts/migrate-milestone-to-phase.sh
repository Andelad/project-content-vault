#!/bin/bash

# Milestone to Phase Migration Script
# Systematically renames all "milestone" references to "phase" in domain layer
# Safe to run - all changes are tracked by git and can be reverted

set -e  # Exit on error

echo "🔄 Starting milestone → phase migration..."
echo ""

# Array of files to process
FILES=(
  "src/domain/rules/phases/PhaseValidation.ts"
  "src/domain/rules/phases/PhaseRules.ts"
)

# Function to do bulk replacements on a file
migrate_file() {
  local file=$1
  echo "📝 Processing $file..."
  
  # Function names
  sed -i '' 's/validateMilestoneScheduling/validatePhaseScheduling/g' "$file"
  sed -i '' 's/calculateMilestoneSegments/calculatePhaseSegments/g' "$file"
  sed -i '' 's/calculateMilestoneDistribution/calculatePhaseDistribution/g' "$file"
  sed -i '' 's/validateMilestoneBudget/validatePhaseBudget/g' "$file"
  sed -i '' 's/validateMilestoneOrder/validatePhaseOrder/g' "$file"
  sed -i '' 's/findNextAvailableMilestoneDate/findNextAvailablePhaseDate/g' "$file"
  sed -i '' 's/calculateMilestoneStatistics/calculatePhaseStatistics/g' "$file"
  sed -i '' 's/getMilestoneSegmentForDate/getPhaseSegmentForDate/g' "$file"
  sed -i '' 's/calculateMilestoneDensity/calculatePhaseDensity/g' "$file"
  sed -i '' 's/calculateAverageMilestoneAllocation/calculateAveragePhaseAllocation/g' "$file"
  sed -i '' 's/calculateOptimalMilestoneSpacing/calculateOptimalPhaseSpacing/g' "$file"
  sed -i '' 's/calculateMilestoneVelocity/calculatePhaseVelocity/g' "$file"
  sed -i '' 's/calculateSuggestedMilestoneBudget/calculateSuggestedPhaseBudget/g' "$file"
  sed -i '' 's/sortMilestonesByDate/sortPhasesByDate/g' "$file"
  sed -i '' 's/findMilestoneGap/findPhaseGap/g' "$file"
  sed -i '' 's/validateMilestoneDateWithinProject/validatePhaseDateWithinProject/g' "$file"
  sed -i '' 's/validateMilestoneDateRange/validatePhaseDateRange/g' "$file"
  sed -i '' 's/validateMilestoneTime/validatePhaseTime/g' "$file"
  sed -i '' 's/validateMilestone(/validatePhase(/g' "$file"
  sed -i '' 's/validateMilestonePosition/validatePhasePosition/g' "$file"
  
  # Type names
  sed -i '' 's/MilestoneSegment/PhaseSegment/g' "$file"
  sed -i '' 's/MilestoneValidationResult/PhaseValidationResult/g' "$file"
  sed -i '' 's/MilestoneDateValidation/PhaseDateValidation/g' "$file"
  sed -i '' 's/MilestoneTimeValidation/PhaseTimeValidation/g' "$file"
  sed -i '' 's/MilestoneDistributionEntry/PhaseDistributionEntry/g' "$file"
  
  # Variable/parameter names
  sed -i '' 's/milestoneEndDate/phaseEndDate/g' "$file"
  sed -i '' 's/milestoneDate/phaseDate/g' "$file"
  sed -i '' 's/milestoneHours/phaseHours/g' "$file"
  sed -i '' 's/newMilestoneDate/newPhaseDate/g' "$file"
  sed -i '' 's/newMilestoneHours/newPhaseHours/g' "$file"
  sed -i '' 's/prevMilestoneDate/prevPhaseDate/g' "$file"
  sed -i '' 's/lastMilestoneDate/lastPhaseDate/g' "$file"
  sed -i '' 's/conflictingMilestone/conflictingPhase/g' "$file"
  sed -i '' 's/otherMilestoneDates/otherPhaseDates/g' "$file"
  sed -i '' 's/milestone:/phase:/g' "$file"
  sed -i '' 's/milestone\./phase\./g' "$file"
  sed -i '' 's/const milestone /const phase /g' "$file"
  sed -i '' 's/detectRecurringPattern(milestones:/detectRecurringPattern(phases:/g' "$file"
  
  # Object properties
  sed -i '' 's/milestone: phase,/phase: phase,/g' "$file"
  sed -i '' 's/milestone: sortedPhases/phase: sortedPhases/g' "$file"
  sed -i '' 's/segment?.milestone/segment?.phase/g' "$file"
  sed -i '' 's/milestone?: PhaseDTO/phase?: PhaseDTO/g' "$file"
  
  # Comments and strings (with spaces to avoid breaking compound words)
  sed -i '' 's/ milestone / phase /g' "$file"
  sed -i '' 's/milestone-related/phase-related/g' "$file"
  sed -i '' 's/milestone allocation/phase allocation/g' "$file"
  sed -i '' 's/milestone budget/phase budget/g' "$file"
  sed -i '' 's/milestone scheduling/phase scheduling/g' "$file"
  sed -i '' 's/milestone density/phase density/g' "$file"
  sed -i '' 's/milestones per day/phases per day/g' "$file"
  sed -i '' 's/milestone distribution/phase distribution/g' "$file"
  sed -i '' 's/milestone segments/phase segments/g' "$file"
  sed -i '' 's/milestone statistics/phase statistics/g' "$file"
  sed -i '' 's/RECURRING MILESTONE/RECURRING PHASE/g' "$file"
  sed -i '' 's/Scheduling milestone occurrences/Scheduling phase occurrences/g' "$file"
  sed -i '' 's/across milestones/across phases/g' "$file"
  sed -i '' 's/adding a new milestone/adding a new phase/g' "$file"
  sed -i '' 's/Sort milestones/Sort phases/g' "$file"
  sed -i '' 's/between consecutive milestones/between consecutive phases/g' "$file"
  sed -i '' 's/first milestone/first phase/g' "$file"
  sed -i '' 's/last milestone/last phase/g' "$file"
  sed -i '' 's/how many milestones/how many phases/g' "$file"
  sed -i '' 's/Generate milestone dates/Generate phase dates/g' "$file"
  sed -i '' 's/first two milestones/first two phases/g' "$file"
  sed -i '' "s/'Recurring Milestone'/'Recurring Phase'/g" "$file"
  sed -i '' 's/Migrated from milestoneUtilitiesService/Migrated from phaseUtilitiesService/g' "$file"
  sed -i '' 's/between milestones/between phases/g' "$file"
  sed -i '' 's/First milestone segment/First phase segment/g' "$file"
  sed -i '' 's/previous milestone/previous phase/g' "$file"
  sed -i '' 's/another milestone/another phase/g' "$file"
  sed -i '' 's/from milestones/from phases/g' "$file"
  sed -i '' 's/project-milestone compatibility/project-phase compatibility/g' "$file"
  sed -i '' 's/low milestone utilization/low phase utilization/g' "$file"
  sed -i '' 's/phases and milestones/phases/g' "$file"
  sed -i '' 's/Single milestones/Single phases/g' "$file"
  sed -i '' 's/Recurring milestones/Recurring phases/g' "$file"
  sed -i '' 's/Milestone date/Phase date/g' "$file"
  sed -i '' 's/milestone is/phase is/g' "$file"
  sed -i '' 's/Milestone start date/Phase start date/g' "$file"
  sed -i '' 's/Milestone time allocation/Phase time allocation/g' "$file"
  sed -i '' 's/Milestone has/Phase has/g' "$file"
  sed -i '' 's/for milestone/for phase/g' "$file"
  sed -i '' 's/existing milestones/existing phases/g' "$file"
  sed -i '' 's/project milestones/project phases/g' "$file"
  sed -i '' 's/other milestones/other phases/g' "$file"
  sed -i '' 's/Milestones must/Phases must/g' "$file"
  sed -i '' 's/Milestones cannot/Phases cannot/g' "$file"
  sed -i '' "s/Validate milestone doesn't/Validate phase doesn't/g" "$file"
  sed -i '' 's/Validate milestone order/Validate phase order/g' "$file"
  sed -i '' 's/Find next available milestone date/Find next available phase date/g' "$file"
  sed -i '' 's/Calculate milestone /Calculate phase /g' "$file"
  sed -i '' 's/Get milestone segment/Get phase segment/g' "$file"
  sed -i '' 's/of new\/updated milestone/of new\/updated phase/g' "$file"
  
  echo "   ✅ Complete"
}

# Process each file
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    migrate_file "$file"
  else
    echo "   ⚠️  File not found: $file"
  fi
done

echo ""
echo "🎉 Migration complete!"
echo ""
echo "📊 Checking results..."

# Count remaining references
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    count=$(grep -c "milestone\|Milestone" "$file" 2>/dev/null || echo "0")
    echo "   $file: $count remaining 'milestone' references"
  fi
done

echo ""
echo "💡 Next steps:"
echo "   1. Review changes: git diff"
echo "   2. Test compilation: npm run build (or tsc)"
echo "   3. If satisfied: git add -A && git commit -m 'refactor: migrate milestone terminology to phase'"
echo "   4. If issues: git restore ."
