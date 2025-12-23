import { CoreError, EXTREQ_REQUEST_CANCELED, EXTREQ_REQUEST_NOT_FOUND, EXTREQ_REQUEST_TIMEOUT } from '@core/errors';
import type { Logger, RuntimeScheduler } from '@core/runtime/types';
import type { CoreEventMap, EventBus } from '../eventBus';
import type { ExternalRequestSnapshot } from './types';

export type ExternalRequestHandlers = {
  onApprove: () => void | Promise<void>;
  onReject: (error: unknown) => void | Promise<void>;
};

export type CreateExternalRequestInput = {
  key: string;
  request: ExternalRequestSnapshot;
  handlers: ExternalRequestHandlers;
  ttlMs?: number;
};

type RequestRecord = {
  id: string;
  key: string;
  request: ExternalRequestSnapshot;
  createdAt: number;
  expiresAt: number;
  state: 'queued' | 'active';
  handlers: ExternalRequestHandlers;
};

export type ExternalRequestsServiceOptions = {
  eventBus: EventBus<CoreEventMap>;
  scheduler: RuntimeScheduler;
  now: () => number;
  logger?: Logger;
  defaultTtlMs: number;
  sweepIntervalMs: number;
  maxActiveRequests: number;
};

export class ExternalRequestsService {
  private readonly eventBus: EventBus<CoreEventMap>;
  private readonly scheduler: RuntimeScheduler;
  private readonly now: () => number;
  private readonly logger?: Logger;

  private readonly maxActiveRequests: number;
  private readonly defaultTtlMs: number;
  private readonly sweepIntervalMs: number;

  private counter = 0;
  private sweepTimerId: ReturnType<RuntimeScheduler['setInterval']> | null = null;

  private readonly records = new Map<string, RequestRecord>();

  // Per-key FIFO queue. Enforces "same key serial".
  private readonly queueByKey = new Map<string, string[]>();

  // key -> active requestId (at most one active per key).
  private readonly activeByKey = new Map<string, string>();

  // Global active set, capped by maxActiveRequests.
  private readonly activeIds = new Set<string>();

  // Fair scheduling across keys (round-robin).
  private readonly keyRoundRobin: string[] = [];

  constructor(options: ExternalRequestsServiceOptions) {
    this.eventBus = options.eventBus;
    this.scheduler = options.scheduler;
    this.now = options.now;
    this.logger = options.logger;
    this.defaultTtlMs = options.defaultTtlMs;
    this.sweepIntervalMs = options.sweepIntervalMs;
    this.maxActiveRequests = options.maxActiveRequests;
  }

  public start(): void {
    if (this.sweepTimerId) return;

    // Sweep interval is lifecycle-managed by ModuleManager via ExternalRequestsModule.start/stop.
    this.sweepTimerId = this.scheduler.setInterval(() => {
      this.purgeExpired('sweep');
      this.tryActivate();
    }, this.sweepIntervalMs);
  }

  public stop(): void {
    // Must release all timers and pending work to avoid open handles in tests/runtime.
    if (this.sweepTimerId) {
      this.scheduler.clearInterval(this.sweepTimerId);
      this.sweepTimerId = null;
    }

    // Cancel active requests first.
    for (const id of Array.from(this.activeIds)) {
      const record = this.records.get(id);
      if (!record) continue;

      const activeForKey = this.activeByKey.get(record.key);
      if (activeForKey === id) this.activeByKey.delete(record.key);

      void record.handlers.onReject(
        new CoreError({
          code: EXTREQ_REQUEST_CANCELED,
          message: 'External request canceled.',
          context: { requestId: id, reason: 'stopped' },
        }),
      );
    }

    // Cancel queued requests.
    for (const [, ids] of this.queueByKey.entries()) {
      for (const id of ids) {
        const record = this.records.get(id);
        if (!record) continue;

        void record.handlers.onReject(
          new CoreError({
            code: EXTREQ_REQUEST_CANCELED,
            message: 'External request canceled.',
            context: { requestId: id, reason: 'stopped' },
          }),
        );
      }
    }

    this.records.clear();
    this.queueByKey.clear();
    this.activeByKey.clear();
    this.activeIds.clear();
    this.keyRoundRobin.length = 0;
  }

  public request(input: CreateExternalRequestInput): string {
    const createdAt = this.now();
    const ttlMs = typeof input.ttlMs === 'number' && input.ttlMs > 0 ? input.ttlMs : this.defaultTtlMs;

    const id = this.createRequestId(createdAt);
    const record: RequestRecord = {
      id,
      key: input.key,
      request: input.request,
      createdAt,
      expiresAt: createdAt + ttlMs,
      state: 'queued',
      handlers: input.handlers,
    };

    this.records.set(id, record);
    this.enqueue(record);

    this.purgeExpired('enqueue');
    this.tryActivate();

    return id;
  }

  public approve(params: { requestId: string }): void {
    const record = this.requireActive(params.requestId);

    this.records.delete(record.id);
    this.activeIds.delete(record.id);

    const activeForKey = this.activeByKey.get(record.key);
    if (activeForKey === record.id) this.activeByKey.delete(record.key);

    void record.handlers.onApprove();
    this.purgeExpired('approve');
    this.tryActivate();
  }

  public reject(params: { requestId: string; error?: unknown }): void {
    const record = this.requireActive(params.requestId);

    this.records.delete(record.id);
    this.activeIds.delete(record.id);

    const activeForKey = this.activeByKey.get(record.key);
    if (activeForKey === record.id) this.activeByKey.delete(record.key);

    void record.handlers.onReject(
      params.error ??
        new CoreError({
          code: EXTREQ_REQUEST_CANCELED,
          message: 'External request rejected.',
          context: { requestId: record.id },
        }),
    );

    this.purgeExpired('reject');
    this.tryActivate();
  }

  private createRequestId(createdAt: number): string {
    this.counter += 1;
    const now36 = createdAt.toString(36);
    return `req_${now36}_${this.counter}`;
  }

  private requireActive(requestId: string): RequestRecord {
    if (!this.activeIds.has(requestId)) {
      throw new CoreError({
        code: EXTREQ_REQUEST_NOT_FOUND,
        message: 'External request not found or not active.',
        context: { requestId },
      });
    }

    const record = this.records.get(requestId);
    if (!record) {
      throw new CoreError({
        code: EXTREQ_REQUEST_NOT_FOUND,
        message: 'External request not found.',
        context: { requestId },
      });
    }

    return record;
  }

  private enqueue(record: RequestRecord): void {
    const list = this.queueByKey.get(record.key) ?? [];
    if (!this.queueByKey.has(record.key)) this.queueByKey.set(record.key, list);

    list.push(record.id);

    if (!this.keyRoundRobin.includes(record.key)) {
      this.keyRoundRobin.push(record.key);
    }
  }

  private tryActivate(): void {
    // Activates requests up to the global cap, while keeping same-key serial (activeByKey).
    while (this.activeIds.size < this.maxActiveRequests) {
      const activated = this.activateNextKeyRoundRobin();
      if (!activated) break;
    }
  }

  private activateNextKeyRoundRobin(): boolean {
    if (this.keyRoundRobin.length === 0) return false;

    for (let i = 0; i < this.keyRoundRobin.length; i += 1) {
      const key = this.keyRoundRobin.shift()!;
      this.keyRoundRobin.push(key);

      if (this.activeByKey.has(key)) continue;

      const queue = this.queueByKey.get(key);
      if (!queue || queue.length === 0) continue;

      const nextId = queue.shift()!;
      const record = this.records.get(nextId);
      if (!record) continue;

      record.state = 'active';
      this.activeByKey.set(key, record.id);
      this.activeIds.add(record.id);

      this.eventBus.emit('external-requests/requested', {
        requestId: record.id,
        request: record.request,
      });
      return true;
    }

    return false;
  }
  private purgeExpired(source: 'sweep' | 'enqueue' | 'approve' | 'reject'): void {
    const now = this.now();

    //  Expire active requests (must also release per-key active lock).
    for (const id of Array.from(this.activeIds)) {
      const record = this.records.get(id);

      if (!record) {
        this.activeIds.delete(id);
        continue;
      }

      if (record.expiresAt > now) continue;

      this.records.delete(id);
      this.activeIds.delete(id);

      const activeForKey = this.activeByKey.get(record.key);
      if (activeForKey === id) this.activeByKey.delete(record.key);

      void record.handlers.onReject(
        new CoreError({
          code: EXTREQ_REQUEST_TIMEOUT,
          message: 'External request timed out.',
          context: { requestId: id, key: record.key, source },
        }),
      );
    }

    //  Expire queued requests per key.
    for (const [key, ids] of this.queueByKey.entries()) {
      const next: string[] = [];

      for (const id of ids) {
        const record = this.records.get(id);
        if (!record) continue;

        if (record.expiresAt <= now) {
          this.records.delete(id);

          void record.handlers.onReject(
            new CoreError({
              code: EXTREQ_REQUEST_TIMEOUT,
              message: 'External request timed out.',
              context: { requestId: id, key, source },
            }),
          );

          continue;
        }

        next.push(id);
      }

      if (next.length === 0) {
        this.queueByKey.delete(key);

        // If the key has no queued items and is not active, remove it from round-robin list.
        if (!this.activeByKey.has(key)) {
          for (let i = this.keyRoundRobin.length - 1; i >= 0; i -= 1) {
            if (this.keyRoundRobin[i] === key) this.keyRoundRobin.splice(i, 1);
          }
        }
      } else {
        this.queueByKey.set(key, next);
      }
    }
  }
}
