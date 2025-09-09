#!/bin/bash

# 🎯 Architecture Improvement Progress Tracker
# Usage: ./scripts/track-progress.sh [check|update|audit]

set -e

PROJECT_ROOT=$(pwd)
PROGRESS_FILE="$PROJECT_ROOT/docs/INCREMENTAL_PROGRESS.md"
AUDIT_DIR="$PROJECT_ROOT/.progress-audits"

# Ensure audit directory exists
mkdir -p "$AUDIT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
    echo "🎯 Architecture Improvement Progress Tracker"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  check   - Check current progress status"
    echo "  audit   - Run full codebase audit for duplicates"
    echo "  update  - Update progress file with current date"
    echo "  types   - Quick audit of duplicate types"
    echo "  calcs   - Quick audit of duplicate calculations"
    echo "  help    - Show this help message"
}

check_progress() {
    echo -e "${BLUE}📊 Current Progress Status${NC}"
    echo ""
    
    # Check TypeScript compilation
    echo -e "${YELLOW}🔍 TypeScript Compilation:${NC}"
    if npx tsc --noEmit --skipLibCheck > /dev/null 2>&1; then
        echo -e "${GREEN}✅ No TypeScript errors${NC}"
    else
        echo -e "${RED}❌ TypeScript errors found${NC}"
        echo "Run: npx tsc --noEmit --skipLibCheck"
        return 1
    fi
    
    # Count current duplicates
    echo -e "${YELLOW}🔍 Duplicate Types:${NC}"
    local project_files=$(find src/ -name "*.ts" -exec grep -l "interface.*Project\|type.*Project" {} \; | wc -l)
    local milestone_files=$(find src/ -name "*.ts" -exec grep -l "interface.*Milestone\|type.*Milestone" {} \; | wc -l)
    
    echo "Project type definitions found in: $project_files files"
    echo "Milestone type definitions found in: $milestone_files files"
    
    # Count calculation functions
    echo -e "${YELLOW}🔍 Calculation Functions:${NC}"
    local calc_functions=$(find src/services/calculations/ -name "*.ts" -exec grep -c "export.*function.*calculate" {} \; 2>/dev/null | awk '{sum+=$1} END {print sum}')
    echo "Total calculation functions: ${calc_functions:-0}"
    
    echo ""
    echo -e "${GREEN}✅ Progress check complete${NC}"
}

audit_duplicates() {
    echo -e "${BLUE}🔍 Running Full Duplicate Audit${NC}"
    echo ""
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local audit_file="$AUDIT_DIR/audit_$timestamp.txt"
    
    echo "Creating audit file: $audit_file"
    echo "# Duplicate Audit - $(date)" > "$audit_file"
    echo "" >> "$audit_file"
    
    # Project type audit
    echo "## Project Type Definitions" >> "$audit_file"
    echo "Files containing Project interfaces/types:" >> "$audit_file"
    find src/ -name "*.ts" -exec grep -l "interface.*Project\|type.*Project" {} \; | while read file; do
        echo "- $file" >> "$audit_file"
        grep -n "interface.*Project\|type.*Project" "$file" >> "$audit_file" 2>/dev/null || true
        echo "" >> "$audit_file"
    done
    
    # Milestone type audit  
    echo "## Milestone Type Definitions" >> "$audit_file"
    echo "Files containing Milestone interfaces/types:" >> "$audit_file"
    find src/ -name "*.ts" -exec grep -l "interface.*Milestone\|type.*Milestone" {} \; | while read file; do
        echo "- $file" >> "$audit_file"
        grep -n "interface.*Milestone\|type.*Milestone" "$file" >> "$audit_file" 2>/dev/null || true
        echo "" >> "$audit_file"
    done
    
    # Calculation function audit
    echo "## Calculation Functions" >> "$audit_file"
    echo "All calculate* functions:" >> "$audit_file"
    find src/ -name "*.ts" -exec grep -Hn "export.*function.*calculate" {} \; >> "$audit_file" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Audit complete: $audit_file${NC}"
}

quick_type_audit() {
    echo -e "${BLUE}🔍 Quick Type Audit${NC}"
    echo ""
    
    echo -e "${YELLOW}Project Types:${NC}"
    find src/ -name "*.ts" -exec grep -l "interface.*Project\|type.*Project" {} \; | head -10
    
    echo ""
    echo -e "${YELLOW}Milestone Types:${NC}"
    find src/ -name "*.ts" -exec grep -l "interface.*Milestone\|type.*Milestone" {} \; | head -10
}

quick_calc_audit() {
    echo -e "${BLUE}🔍 Quick Calculation Audit${NC}"
    echo ""
    
    echo -e "${YELLOW}Recent calculation functions:${NC}"
    find src/services/calculations/ -name "*.ts" -exec grep -H "export.*function.*calculate" {} \; 2>/dev/null | head -15
}

update_progress() {
    local current_date=$(date "+%B %d, %Y")
    
    # Update the last updated date in the progress file
    if [[ -f "$PROGRESS_FILE" ]]; then
        sed -i.bak "s/\*\*Last Updated\*\*: .*/\*\*Last Updated\*\*: $current_date/" "$PROGRESS_FILE"
        echo -e "${GREEN}✅ Updated progress file with current date${NC}"
    else
        echo -e "${RED}❌ Progress file not found: $PROGRESS_FILE${NC}"
        return 1
    fi
}

# Main command handling
case "${1:-help}" in
    "check")
        check_progress
        ;;
    "audit") 
        audit_duplicates
        ;;
    "update")
        update_progress
        ;;
    "types")
        quick_type_audit
        ;;
    "calcs")
        quick_calc_audit
        ;;
    "help"|*)
        show_help
        ;;
esac
