import '@testing-library/jest-dom';
import fetchMock from "jest-fetch-mock";

fetchMock.enableMocks();

// Clear mocks before each test
beforeEach(() => {
  fetch.resetMocks();
  // You might want to clear other global mocks here if needed
});

// Mock next/navigation for useSearchParams, useRouter, usePathname
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
    // prefetch: jest.fn().mockResolvedValue(undefined), // if using prefetch
  })),
  useSearchParams: jest.fn(() => ({
    get: jest.fn((paramName) => {
      // Default mock behavior for get: return null or specific test values if needed globally
      // This can be overridden per test with jest.spyOn or by re-mocking in the test file.
      // Example: if (paramName === 'case_id') return 'mock-case-id-from-jest-setup';
      return null;
    }),
    // Add other useSearchParams methods like getAll, has, etc., if used by components
    // e.g., getAll: jest.fn(() => []),
    // has: jest.fn(() => false),
  })),
  usePathname: jest.fn(() => '/mock-pathname'), // Default mock pathname
}));

// Mock @supabase/auth-helpers-nextjs
// This provides a baseline mock for Supabase client interactions.
// Tests for components that heavily rely on specific Supabase data might need more detailed mocks
// or to override these mocks locally within the test file.
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ 
        data: { session: { user: { id: 'test-user-id-from-jest-setup' } } }, 
        error: null 
      }),
      onAuthStateChange: jest.fn((callback) => {
        // Simulate an initial auth state if needed, or allow tests to trigger the callback
        // For example, to simulate an initial signed-in state:
        // Promise.resolve().then(() => callback('SIGNED_IN', { user: { id: 'test-user-id' } }));
        return {
          data: { subscription: { unsubscribe: jest.fn() } },
        };
      }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signUp: jest.fn().mockResolvedValue({ data: {}, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      // Add other auth methods if they are used by your components
    },
    // Mock other Supabase client features if used directly by components (e.g., storage, functions)
    // storage: {
    //   from: jest.fn().mockReturnThis(),
    //   upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
    //   // ...
    // },
  })),
}));

// Optional: Silence console messages during tests if they become too noisy.
// Comment these out when debugging specific tests.
// global.console = {
//   ...console, // Keep original console for other methods
//   log: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
