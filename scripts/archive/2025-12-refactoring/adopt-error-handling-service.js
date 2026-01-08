#!/usr/bin/env node
/**
 * Batch Error Handling Service Adoption Script
 * Replaces console.error() calls with ErrorHandlingService.logError()
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Files to process (high-value targets)
const filesToProcess = [
  // Orchestrators (highest priority - workflow coordination)
  'src/services/orchestrators/ProjectOrchestrator.ts',
  'src/services/orchestrators/ProjectMilestoneOrchestrator.ts',
  'src/services/orchestrators/EventModalOrchestrator.ts',
  'src/services/orchestrators/timeTrackingOrchestrator.ts',
  'src/services/orchestrators/HolidayModalOrchestrator.ts',
  'src/services/orchestrators/GroupOrchestrator.ts',
  'src/services/orchestrators/CalendarImportOrchestrator.ts',
  'src/services/orchestrators/PlannerViewOrchestrator.ts',
  'src/services/orchestrators/SettingsOrchestrator.ts',
  'src/services/orchestrators/recurringEventsOrchestrator.ts',
  
  // Unified Services (business logic)
  'src/services/unified/UnifiedTimelineService.ts',
  'src/services/unified/UnifiedTimeTrackerService.ts',
  'src/services/unified/UnifiedCalendarService.ts',
  
  // Repositories (data layer)
  'src/services/repositories/timeTrackingRepository.ts',
  
  // Performance Services
  'src/services/performance/dragPerformanceService.ts',
  
  // Hooks (state management)
  'src/hooks/useMilestones.ts',
  'src/hooks/useEvents.ts',
  'src/hooks/useWorkHours.ts',
  'src/hooks/useLabels.ts',
  'src/hooks/useSettings.ts',
  'src/hooks/useRows.ts',
  'src/hooks/useProjectModalState.ts',
];

let totalReplacements = 0;
let filesModified = 0;

console.log('🚀 Starting Error Handling Service adoption...\n');

filesToProcess.forEach(relativePath => {
  const filePath = join(projectRoot, relativePath);
  
  try {
    let content = readFileSync(filePath, 'utf8');
    const originalContent = content;
    let fileReplacements = 0;
    
    // Check if ErrorHandlingService is already imported
    const hasErrorHandlingImport = content.includes('ErrorHandlingService');
    
    // Count console.error occurrences
    const consoleErrorCount = (content.match(/console\.error/g) || []).length;
    
    if (consoleErrorCount === 0) {
      return; // Skip files with no console.error calls
    }
    
    // Pattern 1: Simple console.error('message', error)
    // Replace with: ErrorHandlingService.handle(error, { source: 'ComponentName', action: 'message' })
    const simplePattern = /console\.error\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)\s*\)/g;
    content = content.replace(simplePattern, (match, message, errorVar) => {
      fileReplacements++;
      // Extract component/service name from file path
      const componentName = relativePath.split('/').pop().replace(/\.(ts|tsx)$/, '');
      return `ErrorHandlingService.handle(${errorVar}, { source: '${componentName}', action: '${message}' })`;
    });
    
    // Pattern 2: console.error('message only')
    // Replace with: ErrorHandlingService.handle('message', { source: 'ComponentName' })
    const messageOnlyPattern = /console\.error\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    content = content.replace(messageOnlyPattern, (match, message) => {
      fileReplacements++;
      const componentName = relativePath.split('/').pop().replace(/\.(ts|tsx)$/, '');
      return `ErrorHandlingService.handle('${message}', { source: '${componentName}' })`;
    });
    
    // Pattern 3: console.error(error) - error only
    // Replace with: ErrorHandlingService.handle(error, { source: 'ComponentName' })
    const errorOnlyPattern = /console\.error\(\s*(\w+)\s*\)/g;
    content = content.replace(errorOnlyPattern, (match, errorVar) => {
      fileReplacements++;
      const componentName = relativePath.split('/').pop().replace(/\.(ts|tsx)$/, '');
      return `ErrorHandlingService.handle(${errorVar}, { source: '${componentName}' })`;
    });
    
    // Pattern 4: console.error with template literals
    // console.error(`Error: ${something}`, error)
    const templatePattern = /console\.error\(\s*`([^`]+)`\s*,\s*(\w+)\s*\)/g;
    content = content.replace(templatePattern, (match, message, errorVar) => {
      fileReplacements++;
      const componentName = relativePath.split('/').pop().replace(/\.(ts|tsx)$/, '');
      return `ErrorHandlingService.handle(${errorVar}, { source: '${componentName}', action: \`${message}\` })`;
    });
    
    // Pattern 5: console.error with only template literal
    const templateOnlyPattern = /console\.error\(\s*`([^`]+)`\s*\)/g;
    content = content.replace(templateOnlyPattern, (match, message) => {
      fileReplacements++;
      const componentName = relativePath.split('/').pop().replace(/\.(ts|tsx)$/, '');
      return `ErrorHandlingService.handle(\`${message}\`, { source: '${componentName}' })`;
    });
    
    // If replacements were made and import doesn't exist, add it
    if (fileReplacements > 0 && !hasErrorHandlingImport) {
      // Find the last import statement
      const importPattern = /^import .+ from .+;$/gm;
      const imports = content.match(importPattern);
      
      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const importToAdd = "\nimport { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';";
        
        // Insert after last import
        content = content.replace(lastImport, lastImport + importToAdd);
      }
    }
    
    // Only write if changes were made
    if (content !== originalContent) {
      writeFileSync(filePath, content, 'utf8');
      totalReplacements += fileReplacements;
      filesModified++;
      console.log(`✅ ${relativePath}: ${fileReplacements} replacements`);
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${relativePath}:`, error.message);
  }
});

console.log('\n📊 Summary:');
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total replacements: ${totalReplacements}`);
console.log('\n✨ Error handling service adoption complete!');
console.log('⚠️  Note: Some complex console.error patterns may need manual review');
