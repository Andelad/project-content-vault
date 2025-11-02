#!/bin/bash
# Quick setup script for testing infrastructure

echo "🧪 Setting up testing infrastructure..."
echo ""

# Install dependencies
echo "📦 Installing test dependencies..."
npm install -D vitest@1.0.0 \
  @vitest/ui@1.0.0 \
  @testing-library/react@14.0.0 \
  @testing-library/jest-dom@6.0.0 \
  @testing-library/user-event@14.0.0 \
  msw@2.0.0 \
  @vitest/coverage-v8@1.0.0

echo ""
echo "✅ Dependencies installed"
echo ""

# Create vitest config
echo "⚙️  Creating vitest.config.ts..."
cat > vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
EOF

echo "✅ vitest.config.ts created"
echo ""

# Create test setup file
echo "⚙️  Creating test setup file..."
mkdir -p src/test
cat > src/test/setup.ts << 'EOF'
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest matchers with jest-dom
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ 
        data: { subscription: { unsubscribe: vi.fn() } } 
      }))
    }
  },
  isSupabaseConfigured: true,
  supabaseConfigError: null
}));
EOF

echo "✅ Test setup created"
echo ""

# Update package.json scripts
echo "⚙️  Adding test scripts to package.json..."
npm pkg set scripts.test="vitest"
npm pkg set scripts.test:ui="vitest --ui"
npm pkg set scripts.test:run="vitest run"
npm pkg set scripts.test:coverage="vitest run --coverage"
npm pkg set scripts.test:watch="vitest --watch"

echo "✅ Test scripts added"
echo ""

# Success message
echo "✨ Testing infrastructure setup complete!"
echo ""
echo "📚 Next steps:"
echo "  1. Read docs/TESTING_GUIDE.md for detailed guide"
echo "  2. Run 'npm test' to start test runner"
echo "  3. Look at src/test/example.test.ts to see examples"
echo "  4. Start writing tests for domain/rules/ (easiest wins!)"
echo ""
echo "💡 Quick commands:"
echo "  npm test              - Run tests in watch mode"
echo "  npm run test:ui       - Open visual test UI"
echo "  npm run test:coverage - Generate coverage report"
echo ""
echo "Happy testing! 🎉"
