// Jest setup file for global test configuration

import { TextDecoder, TextEncoder } from 'util';

// jsdom does not expose Node's encoding globals, which the browser-compatible
// MessagePack decoder initializes at module load time.
Object.assign(globalThis, { TextDecoder, TextEncoder });

// jsdom provides the DOM environment automatically, so we don't need to mock it

// Console spy setup for testing console outputs
const originalConsole = global.console;
beforeEach(() => {
  // global.console = {
  //   ...originalConsole,
  //   log: jest.fn(),
  //   error: jest.fn(),
  //   warn: jest.fn(),
  //   info: jest.fn()
  // };
});

afterEach(() => {
  global.console = originalConsole;
});
