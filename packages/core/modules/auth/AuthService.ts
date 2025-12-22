import { AUTH_PASSWORD_REQUEST_CANCELED, AUTH_PASSWORD_REQUEST_TIMEOUT, CoreError } from '@core/errors';
import type { Logger, RuntimeScheduler } from '@core/runtime/types';
import type { CoreEventMap, EventBus } from '../eventBus';

export type PasswordRequestOptions = {
  reason?: string;
  timeoutMs?: number;
};

export type CredentialKind = 'password' | 'biometrics';

type PendingRequest = {
  requestId: string;
  reason?: string;
  timeoutMs: number;
  resolve: (password: string) => void;
  reject: (error: unknown) => void;
};

type ActiveRequest = PendingRequest & {
  kind: CredentialKind;
  timeoutId: ReturnType<RuntimeScheduler['setTimeout']> | null;
};

export type AuthServiceOptions = {
  eventBus: EventBus<CoreEventMap>;
  scheduler: RuntimeScheduler;
  now: () => number;
  logger?: Logger;
  defaultTimeoutMs: number;
  getCredentialKind?: (params: { reason?: string }) => CredentialKind;
};

export class AuthService {
  private readonly eventBus: EventBus<CoreEventMap>;
  private readonly scheduler: RuntimeScheduler;
  private readonly now: () => number;
  private readonly logger?: Logger;
  private readonly defaultTimeoutMs: number;

  private counter = 0;
  private active: ActiveRequest | null = null;
  private readonly queue: PendingRequest[] = [];

  private readonly getCredentialKind: (params: { reason?: string }) => CredentialKind;
  constructor(options: AuthServiceOptions) {
    this.eventBus = options.eventBus;
    this.scheduler = options.scheduler;
    this.now = options.now;
    this.logger = options.logger;
    this.defaultTimeoutMs = options.defaultTimeoutMs;
    this.getCredentialKind = options.getCredentialKind ?? (() => 'password');
  }

  public getPassword(options: PasswordRequestOptions = {}): Promise<string> {
    const timeoutMs = typeof options.timeoutMs === 'number' && options.timeoutMs > 0 ? options.timeoutMs : this.defaultTimeoutMs;
    const requestId = this.createRequestId();

    return new Promise<string>((resolve, reject) => {
      const request: PendingRequest = {
        requestId,
        reason: options.reason,
        timeoutMs,
        resolve,
        reject,
      };

      this.queue.push(request);
      this.activateNextRequestIfIdle();
    });
  }
  public resolvePassword(params: { requestId: string; password: string }): void {
    const active = this.active;
    if (!active || active.requestId !== params.requestId) {
      this.logger?.warn('AuthService:resolve:ignored', { requestId: params.requestId });
      return;
    }

    this.clearActiveTimer();
    this.active = null;

    active.resolve(params.password);
    this.activateNextRequestIfIdle();
  }

  public cancelPasswordRequest(params: { requestId: string }): void {
    const active = this.active;
    if (active && active.requestId === params.requestId) {
      this.clearActiveTimer();
      this.active = null;

      active.reject(
        new CoreError({
          code: AUTH_PASSWORD_REQUEST_CANCELED,
          message: 'Password request canceled.',
          context: { requestId: params.requestId },
        }),
      );

      this.activateNextRequestIfIdle();
      return;
    }
    const index = this.queue.findIndex((r) => r.requestId === params.requestId);
    if (index === -1) {
      this.logger?.warn('AuthService:cancel:ignored', { requestId: params.requestId });
      return;
    }

    const [removed] = this.queue.splice(index, 1);
    removed.reject(
      new CoreError({
        code: AUTH_PASSWORD_REQUEST_CANCELED,
        message: 'Password request canceled.',
        context: { requestId: params.requestId },
      }),
    );
  }

  public stop(): void {
    const active = this.active;
    if (active) {
      this.clearActiveTimer();
      this.active = null;

      active.reject(
        new CoreError({
          code: AUTH_PASSWORD_REQUEST_CANCELED,
          message: 'Password request canceled.',
          context: { requestId: active.requestId, reason: 'stopped' },
        }),
      );
    }

    while (this.queue.length > 0) {
      const req = this.queue.shift()!;
      req.reject(
        new CoreError({
          code: AUTH_PASSWORD_REQUEST_CANCELED,
          message: 'Password request canceled.',
          context: { requestId: req.requestId, reason: 'stopped' },
        }),
      );
    }
  }

  private createRequestId(): string {
    this.counter += 1;
    const now36 = this.now().toString(36);
    return `auth_${now36}_${this.counter}`;
  }

  private activateNextRequestIfIdle(): void {
    if (this.active) return;

    const next = this.queue.shift();
    if (!next) return;

    const kind = this.getCredentialKind({ reason: next.reason });

    const active: ActiveRequest = { ...next, kind, timeoutId: null };
    this.active = active;

    active.timeoutId = this.scheduler.setTimeout(() => {
      if (!this.active || this.active.requestId !== active.requestId) return;

      this.active = null;

      active.reject(
        new CoreError({
          code: AUTH_PASSWORD_REQUEST_TIMEOUT,
          message: 'Password request timed out.',
          context: { requestId: active.requestId, timeoutMs: active.timeoutMs },
        }),
      );

      this.activateNextRequestIfIdle();
    }, active.timeoutMs);

    // kind controls UX only (password input vs system biometrics prompt); both resolve to a string credential.
    this.eventBus.emit('auth/credential-requested', {
      requestId: active.requestId,
      kind: active.kind,
      reason: active.reason,
    });
  }

  private clearActiveTimer(): void {
    const active = this.active;
    if (!active?.timeoutId) return;
    this.scheduler.clearTimeout(active.timeoutId);
    active.timeoutId = null;
  }
}
