#!/bin/bash

echo "🔍 LEGACY MIGRATION ANALYSIS - Projects Feature"
echo "=============================================="

# Make sure we're in the right directory
if [ ! -d "src/services/projects" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

echo "📊 LEGACY IMPORT REFERENCES:"
echo "----------------------------"

# Count imports from projects/legacy
echo "🔹 Direct legacy folder imports:"
legacy_imports=$(grep -r "from '@/services/projects/legacy" src/ 2>/dev/null | wc -l)
echo "   Total references: $legacy_imports"
if [ "$legacy_imports" -gt 0 ]; then
    echo "   Sample files:"
    grep -r "from '@/services/projects/legacy" src/ 2>/dev/null | head -5 | sed 's/^/     /'
fi

echo ""
echo "🔹 Specific legacy service imports:"

# ProjectCalculationService
proj_calc=$(grep -r "ProjectCalculationService" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "\.ts~" | wc -l)
echo "   ProjectCalculationService: $proj_calc references"

# projectProgressCalculationService  
prog_calc=$(grep -r "projectProgressCalculationService" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "\.ts~" | wc -l)
echo "   projectProgressCalculationService: $prog_calc references"

# projectProgressGraphService
prog_graph=$(grep -r "analyzeProjectProgress\|projectProgressGraphService" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "\.ts~" | wc -l)
echo "   projectProgressGraphService: $prog_graph references"

# projectProgressService
prog_service=$(grep -r "calculateEventDurationHours\|calculateProgressEventDurationHours\|calculateProjectTimeMetrics\|ComprehensiveProjectTimeMetrics" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "\.ts~" | wc -l)
echo "   projectProgressService: $prog_service references"

# projectStatusService
status_service=$(grep -r "projectStatusService" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "\.ts~" | wc -l)
echo "   projectStatusService: $status_service references"

# projectWorkingDaysService
working_days=$(grep -r "projectWorkingDaysService" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "\.ts~" | wc -l)
echo "   projectWorkingDaysService: $working_days references"

# projectOverlapService
overlap_service=$(grep -r "projectOverlapService" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "\.ts~" | wc -l)
echo "   projectOverlapService: $overlap_service references"

# ProjectValidationService
validation_service=$(grep -r "ProjectValidationService" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "\.ts~" | wc -l)
echo "   ProjectValidationService: $validation_service references"

echo ""
echo "📁 LEGACY FILES ANALYSIS:"
echo "-------------------------"

# Check if legacy files exist
legacy_file_count=$(find src/services/projects/legacy/ -name "*.ts" 2>/dev/null | wc -l)
echo "🔹 Legacy files found: $legacy_file_count"
if [ "$legacy_file_count" -gt 0 ]; then
    echo "   Files:"
    find src/services/projects/legacy/ -name "*.ts" 2>/dev/null | sed 's/^/     /'
fi

echo ""
echo "📈 BARREL EXPORT ANALYSIS:"
echo "--------------------------"

# Check legacy exports in index.ts
if [ -f "src/services/projects/index.ts" ]; then
    barrel_exports=$(grep -c "legacy/" src/services/projects/index.ts 2>/dev/null || echo "0")
    echo "🔹 Legacy exports in projects/index.ts: $barrel_exports"
    if [ "$barrel_exports" -gt 0 ]; then
        echo "   Legacy export lines:"
        grep "legacy/" src/services/projects/index.ts 2>/dev/null | sed 's/^/     /'
    fi
else
    echo "🔹 projects/index.ts not found"
fi

echo ""
echo "🎯 MIGRATION SIZE ASSESSMENT:"
echo "=============================="

# Total unique files importing legacy
total_files=$(grep -rl "from '@/services/projects/legacy\|ProjectCalculationService\|projectProgressCalculationService\|projectProgressGraphService\|projectProgressService\|projectStatusService\|projectWorkingDaysService\|projectOverlapService\|ProjectValidationService" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "\.ts~" | sort -u | wc -l)
echo "📊 Total files needing import updates: $total_files"

# Calculate total references
total_refs=$((legacy_imports + proj_calc + prog_calc + prog_graph + prog_service + status_service + working_days + overlap_service + validation_service))
echo "📊 Total legacy references: $total_refs"

echo "📊 Legacy service files to migrate: $legacy_file_count"

echo ""
echo "⚠️  MIGRATION EFFORT ESTIMATE:"
echo "==============================="
if [ "$total_files" -gt 20 ]; then
    echo "🔴 HIGH EFFORT - $total_files files to update ($total_refs total references)"
    echo "   Recommended: Phased approach with delegation layer"
    echo "   Strategy: Extract calculations first, create delegation, update gradually"
elif [ "$total_files" -gt 10 ]; then
    echo "🟡 MEDIUM EFFORT - $total_files files to update ($total_refs total references)"
    echo "   Recommended: Extract calculations first, then update imports"
    echo "   Strategy: Move functions to new structure, batch update imports"
else
    echo "🟢 LOW EFFORT - $total_files files to update ($total_refs total references)"
    echo "   Recommended: Direct migration possible"
    echo "   Strategy: Move functions and update imports simultaneously"
fi

echo ""
echo "📋 DETAILED BREAKDOWN:"
echo "======================"
if [ "$total_files" -gt 0 ]; then
    echo "🔍 Files that need import updates:"
    grep -rl "from '@/services/projects/legacy\|ProjectCalculationService\|projectProgressCalculationService\|projectProgressGraphService\|projectProgressService\|projectStatusService\|projectWorkingDaysService\|projectOverlapService\|ProjectValidationService" src/ --exclude-dir=node_modules 2>/dev/null | grep -v "\.ts~" | sort -u | head -10 | sed 's/^/   /'
    
    if [ "$total_files" -gt 10 ]; then
        echo "   ... and $((total_files - 10)) more files"
    fi
fi

echo ""
echo "📋 NEXT STEPS:"
echo "=============="
echo "1. ✅ Analysis complete - run this script to see current numbers"
echo "2. 🔍 Review legacy files for unique functions:"
echo "   grep -r 'export.*function\|export.*=' src/services/projects/legacy/"
echo "3. 📊 Create extraction plan based on effort level: $([ "$total_files" -gt 20 ] && echo "HIGH" || [ "$total_files" -gt 10 ] && echo "MEDIUM" || echo "LOW")"
echo "4. 🚀 Execute phased migration strategy"
echo "5. 🗑️  Delete legacy folder when migration complete"

echo ""
echo "🛠️  QUICK COMMANDS TO GET STARTED:"
echo "=================================="
echo "# Find all exported functions in legacy files:"
echo "grep -r 'export.*function\|export.*=' src/services/projects/legacy/"
echo ""
echo "# Check what's in new domain structure already:"
echo "ls -la src/services/projects/"
echo ""
echo "# Find specific component usage examples:"
echo "grep -r 'ProjectCalculationService' src/components/ | head -3"
