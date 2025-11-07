#!/usr/bin/env node

/**
 * Automated Date Math Fixer
 * Replaces manual date operations with centralized helper functions
 * 
 * Patterns fixed:
 * 1. .setHours(0, 0, 0, 0) → normalizeToMidnight()
 * 2. .setDate(x.getDate() + n) → addDaysToDate(x, n)
 * 3. .setDate(x.getDate() - n) → addDaysToDate(x, -n)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Files already fixed (skip these)
const FIXED_FILES = [
  'ViewportPositioning.ts',
  'TimelineViewportService.ts',
  'holidayCalculations.ts',
  'ProjectMilestoneSection.tsx',
  'ProjectBarPositioning.ts',
  'ProjectMilestoneOrchestrator.ts',
  'DragCoordinator.ts',
  'DragPositioning.ts',
  'dateCalculations.ts' // Has internal usage that's already correct
];

// Find all files with manual date operations
function findFilesWithDateOps() {
  try {
    const cmd = `grep -rl "\\.setHours(0,\\s*0,\\s*0,\\s*0)\\|\\.setDate(.*\\.getDate()" src/ --exclude-dir=backup --exclude="AI Dev Rules.md" 2>/dev/null | grep -v ".backup"`;
    const result = execSync(cmd, { cwd: process.cwd(), encoding: 'utf-8' });
    return result.trim().split('\n').filter(f => {
      const basename = path.basename(f);
      return !FIXED_FILES.includes(basename) && f.length > 0;
    });
  } catch (e) {
    return [];
  }
}

// Check if file needs helper imports
function needsImports(content, filePath) {
  const hasNormalizeToMidnight = /normalizeToMidnight/.test(content);
  const hasAddDaysToDate = /addDaysToDate/.test(content);
  const ext = path.extname(filePath);
  
  // Check what operations exist
  const hasSetHours = /\.setHours\(0,\s*0,\s*0,\s*0\)/.test(content);
  const hasSetDate = /\.setDate\([^)]*\.getDate\(\)/.test(content);
  
  return {
    needsNormalize: hasSetHours && !hasNormalizeToMidnight,
    needsAddDays: hasSetDate && !hasAddDaysToDate,
    isTS: ext === '.ts' || ext === '.tsx'
  };
}

// Add imports to file
function addImports(content, filePath) {
  const needs = needsImports(content, filePath);
  
  if (!needs.needsNormalize && !needs.needsAddDays) {
    return content;
  }
  
  const imports = [];
  if (needs.needsNormalize) imports.push('normalizeToMidnight');
  if (needs.needsAddDays) imports.push('addDaysToDate');
  
  // Find existing imports from @/services or dateCalculations
  const serviceImportMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"]@\/services['"]/);
  const dateCalcImportMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"].*dateCalculations['"]/);
  
  if (serviceImportMatch) {
    // Add to existing @/services import
    const existingImports = serviceImportMatch[1].trim();
    const newImports = [...new Set([...existingImports.split(',').map(s => s.trim()), ...imports])].join(', ');
    content = content.replace(serviceImportMatch[0], `import { ${newImports} } from '@/services'`);
  } else if (dateCalcImportMatch) {
    // Add to existing dateCalculations import
    const existingImports = dateCalcImportMatch[1].trim();
    const newImports = [...new Set([...existingImports.split(',').map(s => s.trim()), ...imports])].join(', ');
    content = content.replace(dateCalcImportMatch[0], `import { ${newImports} } from '../calculations/general/dateCalculations'`);
  } else {
    // Add new import at the top (after first import group)
    const firstImportLine = content.match(/^import\s/m);
    if (firstImportLine) {
      const insertPos = content.indexOf('\n', firstImportLine.index) + 1;
      const importPath = filePath.includes('/services/') 
        ? '@/services'
        : '@/services/calculations/general/dateCalculations';
      content = content.slice(0, insertPos) + 
                `import { ${imports.join(', ')} } from '${importPath}';\n` +
                content.slice(insertPos);
    }
  }
  
  return content;
}

// Fix .setHours(0,0,0,0) patterns
function fixSetHours(content) {
  // Pattern: variable.setHours(0, 0, 0, 0)
  // Replace with: variable = normalizeToMidnight(variable)
  
  // Match: identifier.setHours(0, 0, 0, 0)
  content = content.replace(
    /(\w+)\.setHours\(0,\s*0,\s*0,\s*0\)/g,
    '$1 = normalizeToMidnight($1)'
  );
  
  return content;
}

// Fix .setDate(x.getDate() ± n) patterns
function fixSetDate(content) {
  // Pattern 1: variable.setDate(variable.getDate() + n)
  // Replace with: variable = addDaysToDate(variable, n)
  content = content.replace(
    /(\w+)\.setDate\(\1\.getDate\(\)\s*\+\s*(\d+|[a-zA-Z_]\w*(?:\s*\*\s*\d+)?)\)/g,
    '$1 = addDaysToDate($1, $2)'
  );
  
  // Pattern 2: variable.setDate(variable.getDate() - n)
  // Replace with: variable = addDaysToDate(variable, -n)
  content = content.replace(
    /(\w+)\.setDate\(\1\.getDate\(\)\s*-\s*(\d+|[a-zA-Z_]\w*(?:\s*\*\s*\d+)?)\)/g,
    '$1 = addDaysToDate($1, -$2)'
  );
  
  // Pattern 3: variable.setDate(otherVar.getDate() + n) - different variable
  content = content.replace(
    /(\w+)\.setDate\((\w+)\.getDate\(\)\s*\+\s*(\d+|[a-zA-Z_]\w*(?:\s*\*\s*\d+)?)\)/g,
    '$1 = addDaysToDate($2, $3)'
  );
  
  // Pattern 4: variable.setDate(otherVar.getDate() - n) - different variable
  content = content.replace(
    /(\w+)\.setDate\((\w+)\.getDate\(\)\s*-\s*(\d+|[a-zA-Z_]\w*(?:\s*\*\s*\d+)?)\)/g,
    '$1 = addDaysToDate($2, -$3)'
  );
  
  return content;
}

// Process a single file
function processFile(filePath) {
  console.log(`\n📝 Processing: ${filePath}`);
  
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  // Count operations before
  const setHoursCount = (content.match(/\.setHours\(0,\s*0,\s*0,\s*0\)/g) || []).length;
  const setDateCount = (content.match(/\.setDate\([^)]*\.getDate\(\)/g) || []).length;
  
  if (setHoursCount === 0 && setDateCount === 0) {
    console.log('  ✓ No operations found (may have been fixed)');
    return { fixed: 0, skipped: 0 };
  }
  
  console.log(`  Found: ${setHoursCount} setHours, ${setDateCount} setDate`);
  
  // Add imports first
  content = addImports(content, filePath);
  
  // Fix patterns
  content = fixSetHours(content);
  content = fixSetDate(content);
  
  // Check if anything changed
  if (content === originalContent) {
    console.log('  ⚠️  No changes made (patterns may be complex)');
    return { fixed: 0, skipped: setHoursCount + setDateCount };
  }
  
  // Write back
  fs.writeFileSync(filePath, content, 'utf-8');
  
  // Count operations after
  const remainingSetHours = (content.match(/\.setHours\(0,\s*0,\s*0,\s*0\)/g) || []).length;
  const remainingSetDate = (content.match(/\.setDate\([^)]*\.getDate\(\)/g) || []).length;
  const fixed = (setHoursCount - remainingSetHours) + (setDateCount - remainingSetDate);
  const skipped = remainingSetHours + remainingSetDate;
  
  console.log(`  ✅ Fixed: ${fixed} operations${skipped > 0 ? ` (${skipped} complex patterns skipped)` : ''}`);
  
  return { fixed, skipped };
}

// Main
function main() {
  console.log('🚀 Automated Date Math Fixer');
  console.log('============================\n');
  
  const files = findFilesWithDateOps();
  
  if (files.length === 0) {
    console.log('✨ No files found with manual date operations!');
    return;
  }
  
  console.log(`Found ${files.length} files to process:`);
  files.forEach(f => console.log(`  - ${f}`));
  
  let totalFixed = 0;
  let totalSkipped = 0;
  const results = [];
  
  for (const file of files) {
    const result = processFile(file);
    totalFixed += result.fixed;
    totalSkipped += result.skipped;
    results.push({ file, ...result });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:');
  console.log('='.repeat(60));
  console.log(`Files processed: ${files.length}`);
  console.log(`Operations fixed: ${totalFixed}`);
  console.log(`Complex patterns skipped: ${totalSkipped}`);
  
  if (totalSkipped > 0) {
    console.log('\n⚠️  Files with skipped patterns (may need manual review):');
    results.filter(r => r.skipped > 0).forEach(r => {
      console.log(`  - ${r.file} (${r.skipped} patterns)`);
    });
  }
  
  console.log('\n✅ Done! Run `npm run dev` to verify changes.');
}

main();
