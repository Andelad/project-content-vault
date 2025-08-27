#!/bin/bash

echo "Fixing service imports..."

# Update direct service imports to use barrel export
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' \
  -e 's|from ['\''"]@/services/[^/]*Service['\''"]|from '\''@/services'\''|g' \
  -e 's|from ['\''"]@/services/[^/]*service['\''"]|from '\''@/services'\''|g'

# Fix internal service imports (within service files themselves)
find src/services -name "*.ts" | xargs sed -i '' \
  -e 's|from ['\''"]./DateCalculationService['\''"]|from '\''../core/DateCalculationService'\''|g' \
  -e 's|from ['\''"]./ProjectCalculationService['\''"]|from '\''./ProjectCalculationService'\''|g' \
  -e 's|from ['\''"]@/services/milestoneManagementService['\''"]|from '\''./milestoneManagementService'\''|g'

echo "Import fixes completed!"
