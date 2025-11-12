#!/bin/bash

# Work Hours Infinite Recurrence - Setup & Test Script
# This script helps you set up and test the new work hours system

set -e

echo "🚀 Work Hours Infinite Recurrence Setup"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored messages
print_step() {
    echo -e "${BLUE}➜${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Step 1: Check if Supabase CLI is available
print_step "Checking Supabase CLI..."
if command -v supabase &> /dev/null; then
    print_success "Supabase CLI found"
else
    print_warning "Supabase CLI not found. You'll need to run the migration manually."
    echo "Install with: brew install supabase/tap/supabase (Mac) or npm install -g supabase"
fi

echo ""

# Step 2: Show migration file
print_step "Migration file ready:"
echo "   📄 supabase/migrations/20251112140000_add_work_hour_exceptions.sql"
print_success "Migration creates work_hour_exceptions table"

echo ""

# Step 3: Show next steps
print_step "Next Steps:"
echo ""
echo "1. Run the migration:"
echo "   ${GREEN}Option A (Supabase CLI):${NC}"
echo "   $ cd /Users/andrewjohnston/project-content-vault"
echo "   $ supabase db push"
echo ""
echo "   ${GREEN}Option B (Supabase Dashboard):${NC}"
echo "   - Go to https://supabase.com/dashboard"
echo "   - Select your project"
echo "   - Go to SQL Editor"
echo "   - Copy contents of migration file and run"
echo ""

echo "2. Regenerate TypeScript types (optional but recommended):"
echo "   $ supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts"
echo ""

echo "3. Test the implementation:"
echo "   a) Start dev server: ${GREEN}npm run dev${NC}"
echo "   b) Go to Settings → Work Hours"
echo "   c) Add work slots (e.g., Mon-Fri 9:00-17:00)"
echo "   d) Go to Planner view"
echo "   e) Verify work hours appear for all visible weeks"
echo "   f) Drag a work hour to different time"
echo "   g) Dialog should appear: 'Just this day' or 'All future days'"
echo "   h) Choose 'Just this day' and verify only that day changes"
echo ""

# Step 4: Show implementation details
print_step "Implementation Summary:"
echo ""
echo "✅ Database: work_hour_exceptions table"
echo "✅ Service: UnifiedWorkHourRecurrenceService"
echo "✅ Hook: useWorkHours with exception handling"
echo "✅ UI: WorkHourScopeDialog component"
echo "✅ Integration: PlannerView with scope dialog"
echo ""

print_success "Implementation complete! Ready for testing."
echo ""
echo "📚 Documentation:"
echo "   - ${BLUE}docs/WORK_HOURS_INFINITE_RECURRENCE.md${NC} - Detailed guide"
echo "   - ${BLUE}docs/WORK_HOURS_IMPLEMENTATION_SUMMARY.md${NC} - Quick summary"
echo ""

# Step 5: Offer to run migration if CLI is available
if command -v supabase &> /dev/null; then
    echo ""
    read -p "Would you like to run the migration now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Running migration..."
        if supabase db push; then
            print_success "Migration successful!"
            echo ""
            print_step "Regenerating TypeScript types..."
            if supabase gen types typescript --local > src/integrations/supabase/types.ts 2>/dev/null; then
                print_success "Types regenerated successfully!"
            else
                print_warning "Could not regenerate types. You may need to do this manually."
            fi
        else
            print_error "Migration failed. Please check the error above."
        fi
    fi
fi

echo ""
print_success "Setup complete! 🎉"
echo ""
echo "Happy coding!"
