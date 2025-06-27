import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: './src', // Look for tests and source files in backend/src
  moduleNameMapper: {
    // Handle module aliases (if you have them in tsconfig, like @/*)
    // Example: '^@/(.*)$': '<rootDir>/$1'
    // For now, we are using relative paths, but this is good for the future.
    // Adjust if your tsconfig.backend.json baseUrl and paths are used for aliasing.
    // Since tsconfig.backend.json has "baseUrl": "./backend/src", and "paths": { "@/*": ["*"] }
    // we need to map them for Jest if tests use these aliases.
    // However, my current generated code uses relative paths like '../config', '../utils'.
    // If I change to use '@/' alias in source, this mapper would be crucial:
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@api/(.*)$': '<rootDir>/api/$1',
    // If not using aliases in tests/source code, these might not be strictly necessary yet
    // but good to have if we refactor imports later.
    // For now, the key is that Jest can find the .ts files and ts-jest processes them.
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/', // Ignore compiled output in dist
  ],
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: '../coverage/backend', // Output coverage reports to root coverage/backend
  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}', // Collect coverage from all .ts and .tsx files in src
    '!src/**/*.test.{ts,tsx}', // Exclude test files themselves
    '!src/server.ts', // Usually, the main server bootstrap isn't unit tested this way
    '!src/config/**/*', // Config files might be tested indirectly or have minimal logic
  ],
  // Setup files to run before each test file
  // setupFilesAfterEnv: ['./jest.setup.ts'], // if you need setup like DB connection for integration tests
  verbose: true,
};

export default config;
