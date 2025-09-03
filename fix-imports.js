#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Patterns to replace - from old direct paths to @/services
const importReplacements = [
  // Direct relative paths to services
  { from: /from ['"]\.\.\/\.\.\/services\/[^'"]*['"];?/g, to: "from '@/services';" },
  { from: /from ['"]\.\.\/\.\.\/\.\.\/services\/[^'"]*['"];?/g, to: "from '@/services';" },
  { from: /from ['"]\.\.\/services\/[^'"]*['"];?/g, to: "from '@/services';" },
  
  // @/services with subdirectories (except core)
  { from: /from ['"]@\/services\/projects\/[^'"]*['"];?/g, to: "from '@/services';" },
  { from: /from ['"]@\/services\/timeline\/[^'"]*['"];?/g, to: "from '@/services';" },
  { from: /from ['"]@\/services\/work-hours\/[^'"]*['"];?/g, to: "from '@/services';" },
  { from: /from ['"]@\/services\/events\/[^'"]*['"];?/g, to: "from '@/services';" },
  { from: /from ['"]@\/services\/insights\/[^'"]*['"];?/g, to: "from '@/services';" },
  { from: /from ['"]@\/services\/milestones\/[^'"]*['"];?/g, to: "from '@/services';" },
  { from: /from ['"]@\/services\/settings\/[^'"]*['"];?/g, to: "from '@/services';" },
  { from: /from ['"]@\/services\/tracker\/[^'"]*['"];?/g, to: "from '@/services';" },
  { from: /from ['"]@\/services\/plannerV2\/[^'"]*['"];?/g, to: "from '@/services';" },
  
  // Legacy paths
  { from: /from ['"]@\/services\/[^'"]*\/legacy\/[^'"]*['"];?/g, to: "from '@/services';" },
];

function findTsxFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (stat.isFile() && (item.endsWith('.tsx') || item.endsWith('.ts'))) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function updateImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  for (const replacement of importReplacements) {
    const originalContent = content;
    content = content.replace(replacement.from, replacement.to);
    if (content !== originalContent) {
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated: ${filePath}`);
    return true;
  }
  
  return false;
}

function main() {
  console.log('🚀 Starting batch import fixing...');
  
  const srcDir = path.join(__dirname, 'src');
  if (!fs.existsSync(srcDir)) {
    console.error('❌ src directory not found');
    process.exit(1);
  }
  
  // Find all TypeScript/TSX files
  const files = findTsxFiles(srcDir);
  console.log(`📁 Found ${files.length} TypeScript files`);
  
  let updatedCount = 0;
  
  // Update imports in all files
  for (const file of files) {
    // Skip service files themselves to avoid circular imports
    if (file.includes('/services/')) {
      continue;
    }
    
    try {
      if (updateImports(file)) {
        updatedCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  }
  
  console.log(`\n🎉 Complete! Updated ${updatedCount} files`);
  
  // Run TypeScript check to see what's broken
  console.log('\n🔍 Running TypeScript check...');
  try {
    execSync('npx tsc --noEmit --skipLibCheck', { stdio: 'inherit' });
    console.log('✅ No TypeScript errors!');
  } catch (error) {
    console.log('⚠️  Some TypeScript errors found - these indicate missing exports in services barrel');
  }
}

if (require.main === module) {
  main();
}
