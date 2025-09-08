#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all legacy service files (excluding index.ts and backup files)
function getLegacyServices() {
  const legacyDir = path.join(__dirname, 'src', 'services', 'legacy');
  const services = [];
  
  function scanDirectory(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        scanDirectory(fullPath);
      } else if (item.isFile() && item.name.endsWith('.ts') && 
                 item.name !== 'index.ts' && 
                 !item.name.includes('backup')) {
        const relativePath = path.relative(path.join(__dirname, 'src', 'services', 'legacy'), fullPath);
        services.push(relativePath);
      }
    }
  }
  
  scanDirectory(legacyDir);
  return services.sort();
}

// Check if a service is being imported in the main services index
function checkServiceUsage(servicePath) {
  const indexPath = path.join(__dirname, 'src', 'services', 'index.ts');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  // Convert service path to potential import patterns
  const serviceBasename = path.basename(servicePath, '.ts');
  const serviceDir = path.dirname(servicePath);
  
  // Check for imports from this service
  const patterns = [
    `from './legacy/${servicePath.replace(/\.ts$/, '')}`,
    `from './legacy/${serviceDir}/${serviceBasename}`,
    serviceBasename
  ];
  
  return patterns.some(pattern => indexContent.includes(pattern));
}

// Generate migration report
function generateReport() {
  console.log('🔄 LEGACY SERVICES MIGRATION REPORT');
  console.log('=' .repeat(50));
  
  const legacyServices = getLegacyServices();
  
  console.log(`\n📊 TOTAL LEGACY FILES: ${legacyServices.length}`);
  console.log('\n📋 REMAINING LEGACY SERVICES:');
  
  const activeServices = [];
  const unusedServices = [];
  
  legacyServices.forEach((service, index) => {
    const isUsed = checkServiceUsage(service);
    const status = isUsed ? '🔴 ACTIVE' : '⚪ UNUSED';
    console.log(`${String(index + 1).padStart(2)}. ${service.padEnd(40)} ${status}`);
    
    if (isUsed) {
      activeServices.push(service);
    } else {
      unusedServices.push(service);
    }
  });
  
  console.log(`\n🎯 MIGRATION STATUS:`);
  console.log(`   Active services needing migration: ${activeServices.length}`);
  console.log(`   Unused services (can be removed): ${unusedServices.length}`);
  
  if (activeServices.length > 0) {
    console.log(`\n🔴 PRIORITY SERVICES TO MIGRATE:`);
    activeServices.forEach((service, index) => {
      console.log(`   ${index + 1}. ${service}`);
    });
  }
  
  if (unusedServices.length > 0) {
    console.log(`\n⚪ SERVICES THAT CAN BE REMOVED:`);
    unusedServices.forEach((service, index) => {
      console.log(`   ${index + 1}. ${service}`);
    });
  }
  
  console.log(`\n✅ NEXT STEPS:`);
  if (activeServices.length > 0) {
    console.log(`   1. Migrate the ${activeServices.length} active legacy services`);
    console.log(`   2. Update imports to use new architecture`);
    console.log(`   3. Test functionality`);
  }
  if (unusedServices.length > 0) {
    console.log(`   4. Remove ${unusedServices.length} unused legacy files`);
  }
  if (activeServices.length === 0 && unusedServices.length === 0) {
    console.log(`   🎉 MIGRATION COMPLETE! No legacy services remain.`);
  }
}

// Run report
generateReport();
