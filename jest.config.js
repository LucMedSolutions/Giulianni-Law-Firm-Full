// jest.config.js
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured by Next.js if you use `next/jest`)
    // However, you can add specific aliases here if needed, e.g. for components, lib, etc.
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1', // Adjust if your app directory is structured differently or not under rootDir/app

    // Handle CSS imports (if you're not using CSS modules)
    // If you are using CSS modules, this might not be necessary or might need adjustment
    '^.+\\.(css|sass|scss)$': 'identity-obj-proxy',

    // Handle image imports
    // https://jestjs.io/docs/webpack#handling-static-assets
    '^.+\\.(jpg|jpeg|png|gif|webp|svg)$': `<rootDir>/__mocks__/fileMock.js`,
  },
  preset: 'ts-jest', // Use ts-jest preset for TypeScript
  // transform: { // ts-jest should handle this via preset, but can be explicit
  //   '^.+\\.(ts|tsx)?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  // },
  globals: {
    // Optional: ts-jest configuration
    // 'ts-jest': {
    //   tsconfig: 'tsconfig.json', // or specify a different tsconfig for tests
    // },
  },
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
