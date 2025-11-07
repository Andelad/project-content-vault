#!/usr/bin/env node
/**
 * Batch fix manual date operations
 * Replaces .setHours(0,0,0,0) and .setDate() patterns with helper functions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Files to process (excluding already fixed files)
const filesToProcess = [
  'src/components/shared/AvailabilityCard.tsx',
  'src/components/timeline/ProjectBar.tsx',
  'src/services/calculations/availability/capacityCalculations.ts',
  'src/services/calculations/events/eventCalculations.ts',
  'src/services/unified/UnifiedDayEstimateService.ts',
  'src/services/unified/UnifiedMilestoneService.ts',
  'src/services/unified/UnifiedTimelineService.ts',
  'src/services/ui/positioning/CalendarLayout.ts',
  'src/orchestrators/HolidayModalOrchestrator.ts',
  'src/orchestrators/recurringEventsOrchestrator.ts',
];

let totalReplacements = 0;
let filesModified = 0;

console.log('🔧 Batch Date Math Fixer\n');

filesToProcess.forEach(relPath => {
  const filePath = path.join(path.dirname(__dirname), relPath);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${relPath} (not found)`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let fileReplacements = 0;

  // Pattern 1: Replace .setHours(0, 0, 0, 0) with normalizeToMidnight
  const setHoursRegex = /(\w+)\.setHours\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/g;
  content = content.replace(setHoursRegex, (match, varName) => {
    fileReplacements++;
    return `${varName} = normalizeToMidnight(${varName})`;
  });

  // Pattern 2: Replace .setDate(x.getDate() + n) with addDaysToDate
  const setDatePlusRegex = /(\w+)\.setDate\(\1\.getDate\(\)\s*\+\s*(\d+|[\w.]+)\)/g;
  content = content.replace(setDatePlusRegex, (match, varName, days) => {
    fileReplacements++;
    return `${varName} = addDaysToDate(${varName}, ${days})`;
  });

  // Pattern 3: Replace .setDate(x.getDate() - n) with addDaysToDate (negative)
  const setDateMinusRegex = /(\w+)\.setDate\(\1\.getDate\(\)\s*-\s*(\d+|[\w.]+)\)/g;
  content = content.replace(setDateMinusRegex, (match, varName, days) => {
    fileReplacements++;
    return `${varName} = addDaysToDate(${varName}, -${days})`;
  });

  // Check if we need to add imports
  if (fileReplacements > 0) {
    const needsNormalize = /normalizeToMidnight/.test(content) && !/import.*normalizeToMidnight/.test(originalContent);
    const needsAddDays = /addDaysToDate/.test(content) && !/import.*addDaysToDate/.test(originalContent);
    
    if (needsNormalize || needsAddDays) {
      // Find existing date calculation imports
      const dateCalcImportRegex = /import\s*{([^}]+)}\s*from\s*['"].*dateCalculations['"]/;
      const match = content.match(dateCalcImportRegex);
      
      if (match) {
        // Add to existing import
        const imports = match[1].split(',').map(s => s.trim()).filter(Boolean);
        if (needsNormalize && !imports.includes('normalizeToMidnight')) {
          imports.push('normalizeToMidnight');
        }
        if (needsAddDays && !imports.includes('addDaysToDate')) {
          imports.push('addDaysToDate');
        }
        
        const newImport = `import { ${imports.join(', ')} } from '${match[0].match(/from\s*['"](.*)['"]/)[1]}'`;
        content = content.replace(dateCalcImportRegex, newImport);
      } else {
        // Add new import after first import
        const imports = [];
        if (needsNormalize) imports.push('normalizeToMidnight');
        if (needsAddDays) imports.push('addDaysToDate');
        
        // Determine import path based on file location
        const depth = relPath.split('/').length - 2;
        const importPath = '../'.repeat(depth) + 'services/calculations/general/dateCalculations';
        
        const firstImportMatch = content.match(/^import\s+.+;\s*$/m);
        if (firstImportMatch) {
          const newImport = `import { ${imports.join(', ')} } from '${importPath}';\n`;
          content = content.replace(firstImportMatch[0], firstImportMatch[0] + '\n' + newImport);
        }
      }
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${relPath}: ${fileReplacements} replacements`);
    filesModified++;
    totalReplacements += fileReplacements;
  } else {
    console.log(`⏭️  ${relPath}: No changes needed`);
  }
});

console.log(`\n📊 Summary:`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total replacements: ${totalReplacements}`);
console.log(`\n✨ Done! Run 'npm run dev' to verify.`);
