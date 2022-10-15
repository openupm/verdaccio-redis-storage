import { Logger } from '@verdaccio/types';
import log, { RootLogger, LogLevel } from 'loglevel';

export const logger: Logger = {
  warn: jest.fn(),
  error: jest.fn(),
  // fatal: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(),
  http: jest.fn(),
  trace: jest.fn(),
};

export const rootLogger: RootLogger = {
  warn: jest.fn(),
  error: jest.fn(),
  // fatal: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
  noConflict: jest.fn(),
  getLogger: jest.fn(),
  getLoggers: jest.fn(),
  enableAll: jest.fn(),
  disableAll: jest.fn(),
  setLevel: jest.fn(),
  methodFactory: jest.fn(),
  setDefaultLevel: jest.fn(),
  getLevel: jest.fn(),
  log: jest.fn(),
  levels: {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    SILENT: 5,
  },
  resetLevel: function (): void {},
  default: new Object() as RootLogger
};
