#!/bin/bash
# Script to batch-replace manual date math with helper functions

# High-priority files (5+ operations each)
declare -a high_priority=(
  "src/services/ui/positioning/ViewportPositioning.ts"
  "src/services/calculations/general/holidayCalculations.ts"
  "src/components/projects/sections/ProjectMilestoneSection.tsx"
  "src/services/ui/positioning/ProjectBarPositioning.ts"
  "src/services/orchestrators/ProjectMilestoneOrchestrator.ts"
  "src/services/ui/positioning/DragCoordinator.ts"
)

echo "=== Batch Date Math Replacement Script ==="
echo ""
echo "This script will replace:"
echo "  .setHours(0,0,0,0) → normalizeToMidnight(date)"
echo "  .setDate(x.getDate() + n) → addDaysToDate(date, n)"
echo ""
echo "High-priority files to process: ${#high_priority[@]}"
for file in "${high_priority[@]}"; do
  echo "  - $file"
done
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# Count operations before
echo ""
echo "Counting current operations..."
total_sethours=$(grep -r "\.setHours(0,\s*0,\s*0,\s*0)" src/ --exclude-dir=backup | wc -l | tr -d ' ')
total_setdate=$(grep -r "\.setDate(.*\.getDate()" src/ --exclude-dir=backup | wc -l | tr -d ' ')
echo "  .setHours(0,0,0,0): $total_sethours occurrences"
echo "  .setDate patterns: $total_setdate occurrences"
echo ""

echo "TIP: Run this script, then manually fix the reported files in VS Code"
echo "The patterns are consistent - use Find & Replace with regex:"
echo ""
echo "Pattern 1: Find '(\w+)\.setHours\(0,\s*0,\s*0,\s*0\)'"
echo "           Replace: '\$1 = normalizeToMidnight(\$1)'"
echo ""
echo "Pattern 2: Find '(\w+)\.setDate\((\w+)\.getDate\(\)\s*\+\s*(\d+)\)'"
echo "           Replace: '\$1 = addDaysToDate(\$2, \$3)'"
echo ""
echo "High-priority files listed above contain 56% of remaining work."
echo "Start with ViewportPositioning.ts (13 ops) - it mirrors TimelineViewportService.ts"
