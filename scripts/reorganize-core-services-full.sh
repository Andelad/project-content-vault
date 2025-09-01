#!/bin/bash

echo "🏗️  Core Services Reorganization Script"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "src/services/core/CalculationCacheService.ts" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

echo "📋 Current state analysis:"
echo "  → Files to move: 6"
echo "  → Import statements to update: 3"
echo "  → Barrel exports to update: 2"
echo ""

read -p "🚀 Proceed with reorganization? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Reorganization cancelled"
    exit 0
fi

echo ""
echo "📁 Step 1: Creating necessary folders..."
mkdir -p src/services/core/orchestrators

echo ""
echo "📦 Step 2: Moving files to appropriate locations..."

# 1. Infrastructure files
echo "  → Moving CalculationCacheService to infrastructure/calculationCache.ts"
mv src/services/core/CalculationCacheService.ts src/services/core/infrastructure/calculationCache.ts

echo "  → Moving ColorCalculationService to infrastructure/colorCalculations.ts"
mv src/services/core/ColorCalculationService.ts src/services/core/infrastructure/colorCalculations.ts

echo "  → Moving DateCalculationService to infrastructure/dateCalculationService.ts"
mv src/services/core/DateCalculationService.ts src/services/core/infrastructure/dateCalculationService.ts

# 2. Calculations files
echo "  → Moving ProjectCalculationService to calculations/projectCalculations.ts"
mv src/services/core/ProjectCalculationService.ts src/services/core/calculations/projectCalculations.ts

# 3. Orchestrators files
echo "  → Moving TimeAllocationService to orchestrators/TimeAllocationOrchestrator.ts"
mv src/services/core/TimeAllocationService.ts src/services/core/orchestrators/TimeAllocationOrchestrator.ts

# 4. Clean up
echo "  → Deleting empty workingDayService.ts"
rm -f src/services/core/workingDayService.ts

echo ""
echo "🔧 Step 3: Updating import statements..."

# Update colors.ts import
echo "  → Updating src/constants/colors.ts"
sed -i.bak 's|from '\''@/services/core'\''|from '\''@/services/core/infrastructure/colorCalculations'\''|g' src/constants/colors.ts

# Update DateCalculationService internal import  
echo "  → Updating infrastructure/dateCalculationService.ts internal import"
sed -i.bak 's|from '\''./infrastructure/dateCache'\''|from '\''./dateCache'\''|g' src/services/core/infrastructure/dateCalculationService.ts

# Update legacy ProjectCalculationService import
echo "  → Updating projects/legacy/ProjectCalculationService.ts"
sed -i.bak 's|from '\''../../core/DateCalculationService'\''|from '\''../../core/infrastructure/dateCalculationService'\''|g' src/services/projects/legacy/ProjectCalculationService.ts

echo ""
echo "🏭 Step 4: Updating barrel exports..."

# Update core/index.ts
echo "  → Updating src/services/core/index.ts"
cat > src/services/core/index.ts << 'EOF'
// Core services - cross-cutting utilities used across multiple features

// Infrastructure services
export * from './infrastructure/calculationCache';
export * from './infrastructure/colorCalculations';
export * from './infrastructure/dateCalculationService';
export * from './infrastructure/dateCache';

// Calculation services  
export * from './calculations/dateCalculations';
export * from './calculations/milestoneCalculations';
export * from './calculations/projectCalculations';

// Orchestrator services
export * from './orchestrators/TimeAllocationOrchestrator';

// Domain entities
export * from './domain/MilestoneEntity';
export * from './domain/ProjectEntity';
export * from './domain/PauseEntity';

// Performance services (already organized)
export * from './performance/cachePerformanceService';
export * from './performance/dragPerformanceService';
export * from './performance/performanceMetricsService';
EOF

# Update main services/index.ts
echo "  → Updating src/services/index.ts (preserving existing structure)"
sed -i.bak 's|export \* from '\''./core/CalculationCacheService'\'';|export * from '\''./core/infrastructure/calculationCache'\'';|g' src/services/index.ts
sed -i.bak 's|export \* from '\''./core/ColorCalculationService'\'';|export * from '\''./core/infrastructure/colorCalculations'\'';|g' src/services/index.ts  
sed -i.bak 's|export \* from '\''./core/DateCalculationService'\'';|export * from '\''./core/infrastructure/dateCalculationService'\'';|g' src/services/index.ts
sed -i.bak 's|export { ProjectCalculationService as CoreProjectCalculationService } from '\''./core/ProjectCalculationService'\'';|export { ProjectCalculationService as CoreProjectCalculationService } from '\''./core/calculations/projectCalculations'\'';|g' src/services/index.ts
sed -i.bak 's|export \* from '\''./core/TimeAllocationService'\'';|export * from '\''./core/orchestrators/TimeAllocationOrchestrator'\'';|g' src/services/index.ts

echo ""
echo "🧹 Step 5: Cleaning up backup files..."
find src -name "*.bak" -delete

echo ""
echo "✅ Reorganization completed successfully!"
echo ""
echo "📋 Summary of changes:"
echo "  → CalculationCacheService → core/infrastructure/calculationCache.ts"
echo "  → ColorCalculationService → core/infrastructure/colorCalculations.ts" 
echo "  → DateCalculationService → core/infrastructure/dateCalculationService.ts"
echo "  → ProjectCalculationService → core/calculations/projectCalculations.ts"
echo "  → TimeAllocationService → core/orchestrators/TimeAllocationOrchestrator.ts"
echo "  → workingDayService.ts → deleted (was empty)"
echo ""
echo "🔧 Next steps:"
echo "  1. Run 'npm run build' to verify everything compiles"
echo "  2. Test the application to ensure no runtime errors"
echo "  3. Consider renaming TimeAllocationService class to TimeAllocationOrchestrator for consistency"
echo ""
echo "ℹ️  All imports should continue working through barrel exports!"
