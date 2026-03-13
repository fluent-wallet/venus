import { AUTH_PASSWORD_REQUEST_CANCELED, AUTH_PASSWORD_REQUEST_TIMEOUT, CoreError } from '@core/errors';
import type { Logger, RuntimeScheduler } from '@core/runtime/types';
import type { CoreEventMap, EventBus } from '../eventBus';
import type { AuthReason } from './reasons';

export type PasswordRequestOptions = {
  reason?: AuthReason;
  timeoutMs?: number;
};

export type CredentialKind = 'password' | 'biometrics';

export type CredentialKindLoader = () => Promise<CredentialKind | null>;
export type CredentialKindSaver = (kind: CredentialKind) => Promise<void>;
export type PasswordVerifier = (password: string) => Promise<boolean>;

type PendingRequest = {
  requestId: string;
  reason?: AuthReason;
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
  initialCredentialKind?: CredentialKind;
  getCredentialKind?: (params: { reason?: AuthReason; currentKind: CredentialKind }) => CredentialKind;
  loadCredentialKind?: CredentialKindLoader;
  saveCredentialKind?: CredentialKindSaver;
  verifyPassword?: PasswordVerifier;
};

export class AuthService {
  private readonly eventBus: EventBus<CoreEventMap>;
  private readonly scheduler: RuntimeScheduler;
  private readonly now: () => number;
  private readonly logger?: Logger;
  private readonly defaultTimeoutMs: number;
  private credentialKind: CredentialKind;

  private counter = 0;
  private active: ActiveRequest | null = null;
  private readonly queue: PendingRequest[] = [];

  private readonly getCredentialKind: (params: { reason?: AuthReason; currentKind: CredentialKind }) => CredentialKind;
  private readonly loadCredentialKind?: CredentialKindLoader;
  private readonly saveCredentialKind?: CredentialKindSaver;
  private readonly verifyPasswordFn?: PasswordVerifier;
  constructor(options: AuthServiceOptions) {
    this.eventBus = options.eventBus;
    this.scheduler = options.scheduler;
    this.now = options.now;
    this.logger = options.logger;
    this.defaultTimeoutMs = options.defaultTimeoutMs;
    this.credentialKind = options.initialCredentialKind ?? 'password';
    this.getCredentialKind = options.getCredentialKind ?? ((params) => params.currentKind);
    this.loadCredentialKind = options.loadCredentialKind;
    this.saveCredentialKind = options.saveCredentialKind;
    this.verifyPasswordFn = options.verifyPassword;
  }

  public async hydrateCredentialKind(): Promise<void> {
    if (!this.loadCredentialKind) return;

    try {
      const kind = await this.loadCredentialKind();
      if (kind) {
        this.credentialKind = kind;
      }
    } catch (error) {
      this.logger?.warn('AuthService:hydrateCredentialKind:failed', { error });
    }
  }

  public getCredentialKindValue(): CredentialKind {
    return this.credentialKind;
  }

  public async setCredentialKind(kind: CredentialKind): Promise<void> {
    if (!this.saveCredentialKind) {
      this.credentialKind = kind;
      return;
    }

    try {
      await this.saveCredentialKind(kind);
      this.credentialKind = kind;
    } catch (error) {
      this.logger?.warn('AuthService:setCredentialKind:failed', { kind, error });
      throw error;
    }
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
    this.rejectRequest(
      params,
      () =>
        new CoreError({
          code: AUTH_PASSWORD_REQUEST_CANCELED,
          message: 'Password request canceled.',
          context: { requestId: params.requestId },
        }),
    );
  }

  public rejectPasswordRequest(params: { requestId: string; error: unknown }): void {
    this.rejectRequest(params, () => params.error);
  }

  public async verifyPassword(password: string): Promise<boolean> {
    if (!this.verifyPasswordFn) {
      this.logger?.warn('AuthService:verifyPassword:missingVerifier');
      return false;
    }
    return this.verifyPasswordFn(password);
  }

  private rejectRequest(params: { requestId: string }, createError: () => unknown): void {
    const active = this.active;
    if (active && active.requestId === params.requestId) {
      this.clearActiveTimer();
      this.active = null;
      active.reject(createError());

      this.activateNextRequestIfIdle();
      return;
    }
    const index = this.queue.findIndex((r) => r.requestId === params.requestId);
    if (index === -1) {
      this.logger?.warn('AuthService:cancel:ignored', { requestId: params.requestId });
      return;
    }

    const [removed] = this.queue.splice(index, 1);
    removed.reject(createError());
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

    while (true) {
      const req = this.queue.shift();
      if (!req) break;

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

    const kind = this.getCredentialKind({ reason: next.reason, currentKind: this.credentialKind });

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

    // UI responsibility:
    // - Prompt for credential every time (no caching) and return via resolve/cancel APIs.
    // - Biometrics legacy compatibility: Keychain value may be JSON { cipher, iv, salt } that must be unwrapped using PASSWORD_CRYPTO_KEY (old WalletCoreExtends CryptoToolServer).
    // - Never send secrets through EventBus payloads.
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
