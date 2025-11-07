#!/usr/bin/env node
/**
 * Batch Error Handling Service Adoption Script - BATCH 2
 * Replaces console.error() calls with ErrorHandlingService.handle()
 * Covers remaining files (components, contexts, hooks, utilities)
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Files to process (remaining targets - excluding debug components)
const filesToProcess = [
  // Components
  'src/components/modals/ClientModal.tsx',
  'src/components/modals/EventModal.tsx',
  'src/components/modals/FeedbackModal.tsx',
  'src/components/modals/ProjectModal.tsx',
  'src/components/projects/sections/ProjectMilestoneSection.tsx',
  'src/components/settings/CalendarImport.tsx',
  'src/components/timeline/ProjectBar.tsx',
  'src/components/tracker/TimeTracker.tsx',
  'src/components/views/PlannerView.tsx',
  'src/components/views/ProfileView.tsx',
  'src/components/views/ProjectsView.tsx',
  'src/components/views/TimelineView.tsx',
  'src/components/layout/Sidebar.tsx',
  
  // Contexts
  'src/contexts/PlannerContext.tsx',
  'src/contexts/ProjectContext.tsx',
  'src/contexts/SettingsContext.tsx',
  'src/contexts/TimelineContext.tsx',
  
  // Hooks (additional ones not covered in batch 1)
  'src/hooks/useCalendarConnections.ts',
  'src/hooks/useClients.ts',
  'src/hooks/useGroups.ts',
  'src/hooks/useHabits.ts',
  'src/hooks/useHolidayDrag.ts',
  'src/hooks/useHolidays.ts',
  'src/hooks/usePWAInstall.ts',
  'src/hooks/useProjectResize.ts',
  'src/hooks/useProjects.ts',
  
  // Services
  'src/services/ui/coordination/DragCoordinator.ts',
  'src/services/ui/positioning/ProjectBarPositioning.ts',
  
  // Utilities
  'src/utils/cleanupOrphanedMilestones.ts',
  
  // Integration
  'src/integrations/supabase/client.ts',
];

let totalReplacements = 0;
let filesModified = 0;

console.log('🚀 Starting Error Handling Service adoption - BATCH 2...\n');

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
    const simplePattern = /console\.error\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)\s*\)/g;
    content = content.replace(simplePattern, (match, message, errorVar) => {
      fileReplacements++;
      const componentName = relativePath.split('/').pop().replace(/\.(ts|tsx)$/, '');
      return `ErrorHandlingService.handle(${errorVar}, { source: '${componentName}', action: '${message}' })`;
    });
    
    // Pattern 2: console.error('message only')
    const messageOnlyPattern = /console\.error\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    content = content.replace(messageOnlyPattern, (match, message) => {
      fileReplacements++;
      const componentName = relativePath.split('/').pop().replace(/\.(ts|tsx)$/, '');
      return `ErrorHandlingService.handle('${message}', { source: '${componentName}' })`;
    });
    
    // Pattern 3: console.error(error) - error only
    const errorOnlyPattern = /console\.error\(\s*(\w+)\s*\)/g;
    content = content.replace(errorOnlyPattern, (match, errorVar) => {
      fileReplacements++;
      const componentName = relativePath.split('/').pop().replace(/\.(ts|tsx)$/, '');
      return `ErrorHandlingService.handle(${errorVar}, { source: '${componentName}' })`;
    });
    
    // Pattern 4: console.error with template literals
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
console.log('\n✨ Error handling service adoption BATCH 2 complete!');
console.log('⚠️  Note: Debug components excluded (ErrorBoundary, ViewErrorFallback, etc.)');
console.log('⚠️  Note: Some complex console.error patterns may need manual review');
