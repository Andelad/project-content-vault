#!/bin/bash

# More accurate useEffect dependency audit
echo "🔍 Performing detailed useEffect dependency analysis..."

# Function to check individual files for missing dependency arrays
check_file_useeffects() {
    local file="$1"
    echo ""
    echo "📄 Checking: $file"
    
    # Extract useEffect blocks with context
    grep -n -A 10 "useEffect(" "$file" | grep -E "(useEffect|^\-\-|}, \[|}\);)" | while read line; do
        if [[ "$line" =~ useEffect ]]; then
            echo "  🔍 Found useEffect at line: $line"
        elif [[ "$line" =~ "}, \[" ]]; then
            echo "  ✅ Has dependency array: $line"
        elif [[ "$line" =~ "})\;" ]] && [[ ! "$line" =~ "}, \[" ]]; then
            echo "  ⚠️  Missing dependency array: $line"
        fi
    done
}

# Check the most critical files
echo "Checking critical context files..."
for file in "src/contexts/ProjectContext.tsx" "src/contexts/TimelineContext.tsx" "src/contexts/AuthContext.tsx" "src/contexts/SettingsContext.tsx"; do
    if [ -f "$file" ]; then
        check_file_useeffects "$file"
    fi
done

echo ""
echo "Checking critical view files..."
for file in "src/components/views/TimelineView.tsx" "src/components/views/PlannerView.tsx"; do
    if [ -f "$file" ]; then
        check_file_useeffects "$file"
    fi
done

echo ""
echo "🎯 Manual verification needed for complex useEffect patterns."
echo "✅ Run 'npm run dev' and check console for warnings about missing dependencies."
