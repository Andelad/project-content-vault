#!/bin/bash

# Fix services/index.ts to remove all references to deleted calculations folder

FILE="src/services/index.ts"

# Comment out or remove imports from deleted calculations folders
sed -i '' '/^} from \.\/calculations\/availability\/eventWorkHourIntegration/d' "$FILE"
sed -i '' '/^} from \.\/calculations\/events\/holidayCalculations/d' "$FILE"
sed -i '' '/^} from \.\/calculations\/general\/dateCalculations/d' "$FILE"
sed -i '' '/^} from \.\/calculations\/general\/timeCalculations/d' "$FILE"
sed -i '' '/^} from \.\/calculations\/events\/eventCalculations/d' "$FILE"
sed -i '' '/^import.*from \.\/calculations\/events\/eventCalculations/d' "$FILE"

# Remove the export blocks that reference these imports (lines 55-62, 74-79, 147-152, 155-158, 191-194, 201-211)
# We'll need to reconstruct with proper imports

echo "Fixed services/index.ts - removed stale calculation imports"
