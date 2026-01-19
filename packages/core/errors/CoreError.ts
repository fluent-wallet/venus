export type CoreErrorOptions = {
  code: string;
  message: string;
  cause?: unknown;
  context?: Record<string, unknown>;
};

export class CoreError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public override readonly cause?: unknown;

  constructor(options: CoreErrorOptions) {
    super(options.message);
    this.name = 'CoreError';
    this.code = options.code;
    this.context = options.context;
    this.cause = options.cause;
  }
}
