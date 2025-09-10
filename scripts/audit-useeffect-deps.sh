#!/bin/bash

# Script to audit useEffect dependencies for missing exhaustive deps
echo "🔍 Auditing useEffect dependencies for potential issues..."

# Create audit report
AUDIT_FILE="useEffect_audit_$(date +%Y%m%d_%H%M%S).txt"

echo "📋 useEffect Dependency Audit Report" > "$AUDIT_FILE"
echo "Generated: $(date)" >> "$AUDIT_FILE"
echo "======================================" >> "$AUDIT_FILE"
echo "" >> "$AUDIT_FILE"

# Find all files with useEffect
FILES_WITH_USEEFFECT=$(find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "useEffect")

echo "📁 Files with useEffect hooks:" >> "$AUDIT_FILE"
echo "$FILES_WITH_USEEFFECT" >> "$AUDIT_FILE"
echo "" >> "$AUDIT_FILE"

# Count total useEffect instances
TOTAL_USEEFFECTS=$(find src -name "*.ts" -o -name "*.tsx" | xargs grep -c "useEffect" | awk -F: '{sum += $2} END {print sum}')
echo "📊 Total useEffect instances: $TOTAL_USEEFFECTS" >> "$AUDIT_FILE"
echo "" >> "$AUDIT_FILE"

# Look for potentially problematic patterns
echo "🚨 Potential Issues Found:" >> "$AUDIT_FILE"
echo "" >> "$AUDIT_FILE"

# 1. useEffect with empty dependency array that might need deps
echo "1. Empty dependency arrays (review if deps needed):" >> "$AUDIT_FILE"
find src -name "*.ts" -o -name "*.tsx" | xargs grep -n "useEffect.*\[\]" >> "$AUDIT_FILE" 2>/dev/null || echo "   None found" >> "$AUDIT_FILE"
echo "" >> "$AUDIT_FILE"

# 2. useEffect without dependency array (runs every render)
echo "2. Missing dependency arrays (runs every render):" >> "$AUDIT_FILE"
find src -name "*.ts" -o -name "*.tsx" | xargs grep -n "useEffect(" | grep -v "\[" >> "$AUDIT_FILE" 2>/dev/null || echo "   None found" >> "$AUDIT_FILE"
echo "" >> "$AUDIT_FILE"

# 3. Large dependency arrays (might need optimization)
echo "3. Large dependency arrays (consider useMemo/useCallback):" >> "$AUDIT_FILE"
find src -name "*.ts" -o -name "*.tsx" | xargs grep -n "useEffect.*\[.*,.*,.*,.*\]" >> "$AUDIT_FILE" 2>/dev/null || echo "   None found" >> "$AUDIT_FILE"
echo "" >> "$AUDIT_FILE"

echo "✅ Audit complete! Report saved to: $AUDIT_FILE"
echo ""
echo "🔧 Next steps:"
echo "1. Review the generated report"
echo "2. Check empty dependency arrays for missing dependencies"
echo "3. Add dependency arrays to useEffects that are missing them"
echo "4. Consider useMemo/useCallback for large dependency arrays"
