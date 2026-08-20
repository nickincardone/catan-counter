/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',

  // Test file patterns
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],

  // Ignore specific files that shouldn't be run as tests
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/src/__tests__/gameTransactionLogs/',
    '<rootDir>/src/__tests__/testUtils.ts',
  ],

  // Module resolution
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    // content.ts is the bootstrap entry point: it self-executes on import
    // (setInterval + MutationObserver wiring) and is exercised by the live
    // test-change skill, not unit tests. Excluded to keep coverage meaningful.
    '!src/content.ts',
    // Test fixtures / helpers, not product code.
    '!src/__tests__/**',
  ],

  // A ratchet, not an aspiration: set just below where the suite actually sits,
  // so coverage cannot silently regress. Raise these as tests are added rather
  // than leaving a target nothing enforces.
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Transform configuration
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
        },
      },
    ],
  },

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,
};
