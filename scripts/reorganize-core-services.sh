#!/bin/bash

echo "🏗️  Reorganizing Core Services..."
echo "======================================="

# Create orchestrators folder
echo "📁 Creating orchestrators folder..."
mkdir -p src/services/core/orchestrators

# Move files to appropriate locations
echo "📦 Moving services to appropriate folders..."

# 1. Move CalculationCacheService to infrastructure
echo "  → Moving CalculationCacheService to infrastructure/"
mv src/services/core/CalculationCacheService.ts src/services/core/infrastructure/calculationCache.ts

# 2. Move ColorCalculationService to infrastructure  
echo "  → Moving ColorCalculationService to infrastructure/"
mv src/services/core/ColorCalculationService.ts src/services/core/infrastructure/colorCalculations.ts

# 3. Move DateCalculationService to infrastructure
echo "  → Moving DateCalculationService to infrastructure/"
mv src/services/core/DateCalculationService.ts src/services/core/infrastructure/dateCalculationService.ts

# 4. Move ProjectCalculationService to calculations
echo "  → Moving ProjectCalculationService to calculations/"
mv src/services/core/ProjectCalculationService.ts src/services/core/calculations/projectCalculations.ts

# 5. Move TimeAllocationService to orchestrators
echo "  → Moving TimeAllocationService to orchestrators/"
mv src/services/core/TimeAllocationService.ts src/services/core/orchestrators/TimeAllocationOrchestrator.ts

# 6. Delete empty workingDayService.ts
echo "  → Deleting empty workingDayService.ts"
rm -f src/services/core/workingDayService.ts

echo "✅ File moves completed!"

echo ""
echo "🔧 Next steps (manual):"
echo "1. Update import statements in 3 files"
echo "2. Update barrel exports in core/index.ts and services/index.ts"
echo "3. Update class names if needed (TimeAllocationService → TimeAllocationOrchestrator)"
echo "4. Run npm run build to verify everything works"

echo ""
echo "📝 Files to manually update imports:"
echo "  - src/constants/colors.ts"
echo "  - src/services/core/infrastructure/dateCalculationService.ts (was DateCalculationService.ts)"
echo "  - src/services/projects/legacy/ProjectCalculationService.ts"
