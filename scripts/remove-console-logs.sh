#!/bin/bash

# Script to remove console.log statements from production code
# Keeps console.error and console.warn for important debugging

echo "🧹 Cleaning console.log statements from production code..."

# Find all TypeScript/React files with console.log statements
FILES_WITH_LOGS=$(grep -r "console\.log" src/ --include="*.ts" --include="*.tsx" -l)

if [ -z "$FILES_WITH_LOGS" ]; then
    echo "✅ No console.log statements found!"
    exit 0
fi

echo "📁 Found console.log in the following files:"
echo "$FILES_WITH_LOGS"
echo ""

# Ask for confirmation
if [ "$1" != "--force" ]; then
  read -p "Remove console.log statements? (y/N): " -n 1 -r
  echo ""
  
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled by user"
    exit 0
  fi
fi

# Remove console.log statements but preserve console.warn and console.error
for file in $FILES_WITH_LOGS; do
    echo "🔧 Processing: $file"
    
    # Create backup
    cp "$file" "$file.backup"
    
    # Remove console.log statements (but keep console.warn and console.error)
    # This removes:
    # - console.log(...)
    # - console.debug(...)
    # But keeps:
    # - console.error(...)
    # - console.warn(...)
    sed -i '' -E 's/^[[:space:]]*console\.(log|debug)\([^;]*\);?[[:space:]]*$//g' "$file"
    
    # Remove empty lines that might have been left
    sed -i '' '/^[[:space:]]*$/d' "$file"
    
    echo "   ✓ Cleaned $file"
done

echo ""
echo "🎉 Console.log cleanup complete!"
echo ""
echo "📊 Summary:"
echo "   - Processed $(echo "$FILES_WITH_LOGS" | wc -l) files"
echo "   - Backup files created with .backup extension"
echo "   - Kept console.error and console.warn statements"
echo ""
echo "💡 To restore backups if needed:"
echo "   find src/ -name '*.backup' -exec sh -c 'mv \"$1\" \"${1%.backup}\"' _ {} \\;"
