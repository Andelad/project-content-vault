#!/bin/bash

# Migration Circular Dependency Checker
# Usage: ./scripts/check-circular-dependencies.sh <legacy-service-path>
# Example: ./scripts/check-circular-dependencies.sh src/services/legacy/timeline/TimelinePositioningService.ts

LEGACY_SERVICE=$1

if [ -z "$LEGACY_SERVICE" ]; then
    echo "❌ Usage: $0 <legacy-service-path>"
    echo "   Example: $0 src/services/legacy/timeline/TimelinePositioningService.ts"
    exit 1
fi

if [ ! -f "$LEGACY_SERVICE" ]; then
    echo "❌ File not found: $LEGACY_SERVICE"
    exit 1
fi

SERVICE_NAME=$(basename "$LEGACY_SERVICE" .ts)
SERVICE_DIR=$(dirname "$LEGACY_SERVICE")

echo "🔍 Checking circular dependency risk for: $SERVICE_NAME"
echo "📂 Location: $SERVICE_DIR"
echo ""

# Check for imports from potential target locations
echo "🚨 Checking for imports from new architecture services..."

RISKY_IMPORTS=$(grep -n "from.*@/services/\(ui\|unified\|calculations\|validators\|repositories\|orchestrators\)" "$LEGACY_SERVICE" 2>/dev/null)

if [ -n "$RISKY_IMPORTS" ]; then
    echo "❌ HIGH RISK: Circular dependency detected!"
    echo "   Legacy service imports from new architecture:"
    echo "$RISKY_IMPORTS" | sed 's/^/     /'
    echo ""
    echo "⚠️  MIGRATION STRATEGY: Complete implementation move required"
    echo "   - Copy full implementation from legacy to new service"
    echo "   - Do NOT create delegation wrapper"
    echo "   - Update all imports immediately"
    echo ""
    exit 2
else
    echo "✅ LOW RISK: No circular dependency detected"
    echo "   Safe to use delegation pattern with migration wrapper"
    echo ""
fi

# Check what other services might be importing this legacy service
echo "📋 Finding all imports of this legacy service..."
CONSUMERS=$(grep -r "from.*$SERVICE_NAME" src/ --include="*.ts" --include="*.tsx" | grep -v "$LEGACY_SERVICE")

if [ -n "$CONSUMERS" ]; then
    echo "📊 Files that import $SERVICE_NAME:"
    echo "$CONSUMERS" | sed 's/^/   /'
    echo ""
    echo "📝 These files will need import updates after migration"
else
    echo "ℹ️  No direct imports found (service may be used through barrel exports)"
fi

echo ""
echo "✅ Circular dependency check complete"
