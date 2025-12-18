import type { Container } from 'inversify';

export type TimerId = ReturnType<typeof globalThis.setTimeout>;

export type RuntimeScheduler = {
  setTimeout: (handler: () => void, timeoutMs: number) => TimerId;
  clearTimeout: (id: TimerId) => void;
  setInterval: (handler: () => void, intervalMs: number) => TimerId;
  clearInterval: (id: TimerId) => void;
};
export type Logger = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

export type RuntimeConfig = {
  walletConnect?: Record<string, unknown>;
  sync?: Record<string, unknown>;
  chainStatus?: Record<string, unknown>;
} & Record<string, unknown>;

export type RuntimeContext = {
  container: Container;
  logger: Logger;
  config: RuntimeConfig;
  now: () => number;
  scheduler: RuntimeScheduler;
};

export type RuntimeModule = {
  id: string;
  dependencies?: readonly string[];
  register?: (context: RuntimeContext) => void;
  start?: (context: RuntimeContext) => Promise<void> | void;
  stop?: (context: RuntimeContext) => Promise<void> | void;
};
