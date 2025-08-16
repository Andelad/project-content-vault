import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Get build timestamp
const buildTimestamp = new Date().toISOString();
const buildDate = new Date().toLocaleDateString('en-US', { 
  year: 'numeric', 
  month: 'short', 
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

// Create environment variables content with just build info
const envContent = `VITE_BUILD_TIMESTAMP=${buildTimestamp}
VITE_BUILD_DATE=${buildDate}
`;

// Write to .env.local file
writeFileSync(join(__dirname, '..', '.env.local'), envContent);

console.log(`Build info captured: ${buildDate}`);