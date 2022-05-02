import { Logger } from '../tools';

export function createSilentLogger(): Logger {
  return {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}
