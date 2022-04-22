export type Log = (...args: any[]) => void;

export interface Logger {
  info: Log;
  error: Log;
  debug: Log;
}

interface ConsoleLoggerCreation {
  debugEnabled?: boolean;
}

export function createConsoleLogger(
  creation: ConsoleLoggerCreation = {}
): Logger {
  const { debugEnabled = false } = creation;
  return {
    info: console.info.bind(console),
    error: console.error.bind(console),
    debug: debugEnabled ? console.debug.bind(console) : () => undefined,
  };
}
