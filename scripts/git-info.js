import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  // Get git information
  const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  const commitCount = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
  const branchName = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  
  // Create environment variables content
  const envContent = `VITE_GIT_COMMIT_HASH=${commitHash}
VITE_GIT_COMMIT_COUNT=${commitCount}
VITE_GIT_BRANCH=${branchName}
`;

  // Write to .env.local file
  writeFileSync(join(__dirname, '..', '.env.local'), envContent);
  
  console.log(`Git info captured: ${branchName} #${commitCount} (${commitHash})`);
} catch (error) {
  console.warn('Git information not available:', error.message);
  // Write fallback values
  const envContent = `VITE_GIT_COMMIT_HASH=unknown
VITE_GIT_COMMIT_COUNT=0
VITE_GIT_BRANCH=unknown
`;
  writeFileSync(join(__dirname, '..', '.env.local'), envContent);
}