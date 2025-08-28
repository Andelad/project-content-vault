#!/bin/bash

# Fix all service imports to use the main barrel export
echo "Fixing service imports to use barrel export..."

# List of service imports to replace with @/services
services=(
    "calendarIntegration"
    "calendarInsightService" 
    "calendarPositioningService"
    "performanceMetricsService"
    "milestoneCalculationService"
    "projectProgressGraphService"
    "projectWorkingDaysService"
    "settingsValidationService"
    "timeFormattingService"
    "workHourCreationService"
    "timelinePositionService"
    "HeightCalculationService"
    "TimeAllocationService"
    "dragCalculationService"
    "timelineViewportService"
    "WorkHourCalculationService"
    "eventSplittingService"
)

# Replace each individual service import with barrel import
for service in "${services[@]}"; do
    echo "Replacing @/services/$service with @/services"
    find src -name "*.tsx" -o -name "*.ts" | xargs sed -i '' "s|@/services/$service|@/services|g"
done

echo "✅ All service imports updated to use barrel export!"
