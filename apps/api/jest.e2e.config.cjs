/**
 * End-to-end test configuration.
 * Boots a real PostgreSQL (embedded, or any DATABASE_URL_TEST you provide),
 * applies migrations, seeds demo data, then runs the HTTP flow tests.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  globalSetup: '<rootDir>/test/global-setup.js',
  globalTeardown: '<rootDir>/test/global-teardown.js',
  testTimeout: 60000,
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
};
