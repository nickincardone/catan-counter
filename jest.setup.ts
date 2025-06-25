// Jest setup file for global test configuration

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
