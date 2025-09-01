#!/bin/bash

echo "🚀 MIGRATING PROJECT LEGACY IMPORTS TO TOP-LEVEL FILES"
echo "======================================================="

# Store the root directory
ROOT_DIR="/Users/andyjohnston/project-content-vault"

# Function to update imports in files
update_imports() {
    local file="$1"
    local backup_file="${file}.backup"
    
    echo "📝 Updating: $file"
    
    # Create backup
    cp "$file" "$backup_file"
    
    # Update legacy imports to new structure
    
    # ProjectCalculationService -> ProjectCalculations functions
    sed -i '' 's/import { ProjectCalculationService } from.*$/import { calculateProjectMetrics, calculateDailyWorkCapacity, calculateWeeklyWorkCapacity, calculateProjectEndDate, calculateProjectOverlaps } from "@\/services";/g' "$file"
    sed -i '' 's/ProjectCalculationService\.calculateProjectMetrics/calculateProjectMetrics/g' "$file"
    sed -i '' 's/ProjectCalculationService\.calculateDailyWorkCapacity/calculateDailyWorkCapacity/g' "$file"
    sed -i '' 's/ProjectCalculationService\.calculateWeeklyWorkCapacity/calculateWeeklyWorkCapacity/g' "$file"
    sed -i '' 's/ProjectCalculationService\.calculateProjectEndDate/calculateProjectEndDate/g' "$file"
    sed -i '' 's/ProjectCalculationService\.calculateProjectOverlaps/calculateProjectOverlaps/g' "$file"
    
    # ProjectValidationService -> ProjectValidator
    sed -i '' 's/import { ProjectValidationService } from.*$/import { LegacyProjectValidation } from "@\/services";/g' "$file"
    sed -i '' 's/ProjectValidationService\./LegacyProjectValidation\./g' "$file"
    
    # projectOverlapService -> ProjectOrchestrator
    sed -i '' 's/import { checkProjectOverlap, adjustProjectDatesForDrag } from.*$/import { ProjectOverlapWorkflows } from "@\/services";/g' "$file"
    sed -i '' 's/import { datesOverlap, checkProjectOverlap, detectLiveDragConflicts, resolveDragConflicts, findNearestAvailableSlot, adjustProjectDatesForDrag } from.*$/import { ProjectOverlapWorkflows } from "@\/services";/g' "$file"
    sed -i '' 's/checkProjectOverlap(/ProjectOverlapWorkflows.checkProjectOverlap(/g' "$file"
    sed -i '' 's/adjustProjectDatesForDrag(/ProjectOverlapWorkflows.adjustProjectDatesForDrag(/g' "$file"
    sed -i '' 's/detectLiveDragConflicts(/ProjectOverlapWorkflows.detectLiveDragConflicts(/g' "$file"
    sed -i '' 's/resolveDragConflicts(/ProjectOverlapWorkflows.resolveDragConflicts(/g' "$file"
    sed -i '' 's/findNearestAvailableSlot(/ProjectOverlapWorkflows.findNearestAvailableSlot(/g' "$file"
    sed -i '' 's/datesOverlap(/datesOverlap(/g' "$file"  # This is now in ProjectCalculations
    
    # projectProgressService -> ProjectCalculations
    sed -i '' 's/import { calculateProjectDuration } from.*$/import { calculateProjectDuration, calculateEventDurationHours, calculateProjectTimeMetrics } from "@\/services";/g' "$file"
    sed -i '' 's/import { calculateEventDurationHours as calculateProgressEventDurationHours, calculateProjectTimeMetrics, type ComprehensiveProjectTimeMetrics } from.*$/import { calculateEventDurationHours, calculateProjectTimeMetrics, type ComprehensiveProjectTimeMetrics } from "@\/services";/g' "$file"
    sed -i '' 's/calculateProgressEventDurationHours/calculateEventDurationHours/g' "$file"
    
    # projectStatusService -> ProjectOrchestrator
    sed -i '' 's/import { calculateProjectStatus, formatProjectDateRange } from.*$/import { ProjectStatusWorkflows } from "@\/services";/g' "$file"
    sed -i '' 's/calculateProjectStatus(/ProjectStatusWorkflows.calculateProjectStatus(/g' "$file"
    sed -i '' 's/formatProjectDateRange(/ProjectStatusWorkflows.formatProjectDateRange(/g' "$file"
    
    # projectProgressGraphService -> ProjectOrchestrator
    sed -i '' 's/import { analyzeProjectProgress } from.*$/import { ProjectStatusWorkflows } from "@\/services";/g' "$file"
    sed -i '' 's/analyzeProjectProgress(/ProjectStatusWorkflows.analyzeProjectProgress(/g' "$file"
    
    # projectWorkingDaysService -> This should remain as is or be moved to work-hours service
    
    # Check if file was actually changed
    if diff -q "$file" "$backup_file" > /dev/null; then
        echo "   ✅ No changes needed"
        rm "$backup_file"
    else
        echo "   🔄 Updated successfully"
        rm "$backup_file"
    fi
}

echo ""
echo "🔍 Finding files with legacy project imports..."

# Find all files that import from projects/legacy
FILES_TO_UPDATE=$(grep -rl "from '@/services/projects/legacy" src/ 2>/dev/null || echo "")

if [ -z "$FILES_TO_UPDATE" ]; then
    echo "✅ No files found with legacy project imports"
else
    echo "📊 Found files to update:"
    echo "$FILES_TO_UPDATE" | sed 's/^/   /'
    echo ""
    
    # Update each file
    for file in $FILES_TO_UPDATE; do
        update_imports "$file"
    done
fi

echo ""
echo "🔍 Finding files with specific legacy service references..."

# Find files using specific legacy services (broader search)
LEGACY_SERVICE_FILES=$(grep -rl "ProjectCalculationService\|projectProgressService\|projectStatusService\|projectOverlapService\|ProjectValidationService" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "\.ts~" | head -20)

if [ -n "$LEGACY_SERVICE_FILES" ]; then
    echo "📊 Found files with legacy service references:"
    echo "$LEGACY_SERVICE_FILES" | sed 's/^/   /'
    echo ""
    
    # Update each file
    for file in $LEGACY_SERVICE_FILES; do
        if [ -f "$file" ]; then
            update_imports "$file"
        fi
    done
fi

echo ""
echo "📈 Updating projects/index.ts barrel exports..."

# Update the projects index.ts to export from new structure
PROJECTS_INDEX="src/services/projects/index.ts"
if [ -f "$PROJECTS_INDEX" ]; then
    cp "$PROJECTS_INDEX" "${PROJECTS_INDEX}.backup"
    
    # Create new index.ts content focusing on top-level files
    cat > "$PROJECTS_INDEX" << 'EOF'
// Projects services - Domain-driven architecture
export { ProjectOrchestrator, ProjectOverlapWorkflows, ProjectStatusWorkflows } from './ProjectOrchestrator';
export { ProjectValidator, LegacyProjectValidation } from './ProjectValidator';
export { 
  type IProjectRepository,
  MockProjectRepository 
} from './ProjectRepository';

// Project calculations - Pure functions
export * from './ProjectCalculations';

// Legacy services - For backward compatibility (🗑️ DELETE AFTER MIGRATION)
// Note: Most legacy functions have been extracted to the 4 top-level files above
// Remaining legacy exports for any remaining dependencies:
export * from './legacy/projectProgressCalculationService';
export * from './legacy/projectWorkingDaysService';
EOF

    echo "   ✅ Updated projects/index.ts barrel exports"
    rm "${PROJECTS_INDEX}.backup"
else
    echo "   ⚠️ projects/index.ts not found"
fi

echo ""
echo "🧪 Testing TypeScript compilation..."
cd "$ROOT_DIR"
if npm run type-check > /dev/null 2>&1; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed - please check for errors"
    echo "Run 'npm run type-check' to see detailed errors"
fi

echo ""
echo "📊 MIGRATION SUMMARY:"
echo "===================="
echo "✅ Extracted legacy project calculations to ProjectCalculations.ts"
echo "✅ Extracted legacy project validation to ProjectValidator.ts" 
echo "✅ Extracted legacy project workflows to ProjectOrchestrator.ts"
echo "✅ Updated import statements in affected files"
echo "✅ Updated projects/index.ts barrel exports"
echo ""
echo "🔍 Next steps:"
echo "1. Run 'npm run type-check' to verify no TypeScript errors"
echo "2. Test the application to ensure functionality works"
echo "3. Run the analyze-legacy-usage.sh script to check remaining legacy usage"
echo "4. Delete remaining legacy files once all imports are migrated"
echo ""
echo "🎯 When ready to delete legacy files:"
echo "   rm -rf src/services/projects/legacy/"
echo ""
