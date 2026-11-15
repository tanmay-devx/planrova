import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'vendor-firebase';
          }
        }
      }
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.{test,spec}.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 65,
        statements: 75
      },
      include: [
        'shared/domain/**/*.js',
        'server/proxy.js',
        'src/db/**/*.js',
        'src/utils/**/*.js',
        'mobile/src/config/api.js',
        'mobile/src/hooks/useFirestoreData.js'
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/*.config.*',
        'tests/**',
        'docs/**',
        'server/db.js',
        'server/index.js'
      ]
    }
  },
});

