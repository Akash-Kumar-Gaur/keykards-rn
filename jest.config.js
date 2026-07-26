/**
 * Jest config for pure-logic unit tests (crypto core, redaction).
 *
 * These tests run in a plain Node environment using Node's native WebCrypto —
 * NO React Native / Expo runtime required. That is why the crypto core and
 * redaction utility were written with zero Expo imports in their tested paths.
 */

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        isolatedModules: true,
        diagnostics: false,
        tsconfig: {
          module: 'commonjs',
          target: 'es2020',
          esModuleInterop: true,
          skipLibCheck: true,
          lib: ['es2020', 'dom'],
        },
      },
    ],
  },
};
