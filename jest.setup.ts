// jest.setup.ts

// Force TextEncoder and TextDecoder to be globally available from Node's util module
// This MUST be at the very top, before any other imports or code that might need it (like undici)
globalThis.TextEncoder = require('util').TextEncoder;
(globalThis as any).TextDecoder = require('util').TextDecoder;

// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// You can add other global setup here if needed, for example:
// import { server } from './mocks/server'; // if using MSW for API mocking
// beforeAll(() => server.listen());
// afterEach(() => server.resetHandlers());
// afterAll(() => server.close());

// Re-adding undici polyfills. These need to be AFTER TextEncoder/Decoder.
import {
  Request as UndiciRequest,
  Response as UndiciResponse,
  Headers as UndiciHeaders,
  fetch as undiciFetch,
} from 'undici';

if (typeof globalThis.Request === 'undefined') {
  (globalThis as any).Request = UndiciRequest;
}
if (typeof globalThis.Response === 'undefined') {
  (globalThis as any).Response = UndiciResponse;
}
if (typeof globalThis.Headers === 'undefined') {
  (globalThis as any).Headers = UndiciHeaders;
}
if (typeof globalThis.fetch === 'undefined') {
  (globalThis as any).fetch = undiciFetch;
}
// import { server } from './mocks/server'; // if using MSW for API mocking
// beforeAll(() => server.listen());
// afterEach(() => server.resetHandlers());
// afterAll(() => server.close());
