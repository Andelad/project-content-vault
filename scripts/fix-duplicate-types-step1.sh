#!/bin/bash

# 🎯 Quick Fix: Remove Duplicate Project Types
# This script removes duplicate Project and Milestone interfaces from projectProgressCalculations.ts

set -e

echo "🔧 Removing duplicate types from projectProgressCalculations.ts"

FILE="src/services/calculations/projectProgressCalculations.ts"
BACKUP_FILE="$FILE.backup.$(date +%Y%m%d_%H%M%S)"

# Create backup
cp "$FILE" "$BACKUP_FILE"
echo "📋 Created backup: $BACKUP_FILE"

# Check current TypeScript compilation
echo "🔍 Checking current TypeScript compilation..."
if ! npx tsc --noEmit --skipLibCheck > /dev/null 2>&1; then
    echo "❌ TypeScript errors exist. Fix these first:"
    npx tsc --noEmit --skipLibCheck
    exit 1
fi

echo "✅ TypeScript compilation is clean"

# The changes we need to make:
echo "🔄 Applying type consolidation changes..."

# 1. Update imports to use core types
sed -i.tmp '1s/.*/import type { Milestone, Project } from "@\/types\/core";/' "$FILE"

# 2. Remove duplicate interface definitions (we'll do this manually for safety)
echo ""
echo "⚠️  MANUAL STEP REQUIRED:"
echo "Please edit $FILE and:"
echo "1. Remove the 'Milestone' interface (lines ~18-24)"  
echo "2. Remove the 'ProgressProject' interface (lines ~26-31)"
echo "3. Replace 'ProgressProject' usage with 'Project'"
echo ""
echo "Then run: ./scripts/track-progress.sh check"
echo ""
echo "If you need to rollback: mv '$BACKUP_FILE' '$FILE'"

rm -f "$FILE.tmp"
