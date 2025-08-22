import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { execSync } from "child_process";
import { visualizer } from "rollup-plugin-visualizer";

// Get Git information at build time
function getGitInfo() {
  try {
    const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const commitCount = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
    const branchName = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    return { commitHash, commitCount, branchName };
  } catch (error) {
    console.warn('Git information not available:', (error as Error).message);
    return { commitHash: 'unknown', commitCount: '0', branchName: 'unknown' };
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const gitInfo = getGitInfo();
  
  return {
  server: {
    host: "::",
    port: 8080,
  },
    plugins: [
      react(),
      mode === 'development' &&
      componentTagger(),
      mode === 'production' && visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap', // Use treemap for better visualization
      })
    ].filter(Boolean),
    define: {
      'import.meta.env.VITE_GIT_COMMIT_HASH': JSON.stringify(gitInfo.commitHash),
      'import.meta.env.VITE_GIT_COMMIT_COUNT': JSON.stringify(gitInfo.commitCount),
      'import.meta.env.VITE_GIT_BRANCH': JSON.stringify(gitInfo.branchName),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            ui: [
              '@radix-ui/react-dialog', 
              '@radix-ui/react-popover', 
              '@radix-ui/react-toast',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-select'
            ],
            calendar: ['react-big-calendar', 'moment'],
            charts: ['recharts'],
            forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
            utils: ['date-fns', 'dompurify', 'clsx', 'tailwind-merge']
          }
        }
      },
      chunkSizeWarningLimit: 600 // Increase warning limit since we're optimizing chunks
    }
  };
});
