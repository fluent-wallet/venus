import { CoreError, MM_CYCLE_DEPENDENCY, MM_MISSING_DEPENDENCY, MM_START_FAILED } from '@core/errors';
import { Container } from 'inversify';
import type { Logger, RuntimeConfig, RuntimeContext, RuntimeModule, RuntimeScheduler } from './types';

type ModuleRecord = {
  module: RuntimeModule;
  dependencies: readonly string[];
};

type BackgroundStart = { moduleId: string; module: RuntimeModule };

const createDefaultLogger = (): Logger => {
  return {
    debug: (message, meta) => console.debug(message, meta),
    info: (message, meta) => console.info(message, meta),
    warn: (message, meta) => console.warn(message, meta),
    error: (message, meta) => console.error(message, meta),
  };
};

const createDefaultScheduler = (): RuntimeScheduler => {
  return {
    setTimeout: (handler, timeoutMs) => setTimeout(handler, timeoutMs),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (handler, intervalMs) => setInterval(handler, intervalMs),
    clearInterval: (id) => clearInterval(id),
  };
};

export type ModuleManagerOptions = {
  container?: Container;
  logger?: Logger;
  config?: RuntimeConfig;
  now?: () => number;
  scheduler?: RuntimeScheduler;
};

export class ModuleManager {
  public readonly context: RuntimeContext;

  private readonly modules = new Map<string, ModuleRecord>();
  private readonly registered = new Set<string>();
  private started = false;

  constructor(options: ModuleManagerOptions = {}) {
    const container = options.container ?? new Container({ defaultScope: 'Singleton' });

    this.context = {
      container,
      logger: options.logger ?? createDefaultLogger(),
      config: options.config ?? {},
      now: options.now ?? (() => Date.now()),
      scheduler: options.scheduler ?? createDefaultScheduler(),
    };
  }

  public register(modules: RuntimeModule | RuntimeModule[]): void {
    if (this.started) {
      this.context.logger.warn('ModuleManager:register:already-started');
      return;
    }

    const list = Array.isArray(modules) ? modules : [modules];

    for (const module of list) {
      const id = module.id;
      if (this.modules.has(id)) {
        this.context.logger.warn('ModuleManager:register:duplicate-module', { moduleId: id });
        continue;
      }

      this.modules.set(id, {
        module,
        dependencies: module.dependencies ?? [],
      });
    }
  }

  public async start(): Promise<void> {
    if (this.started) {
      this.context.logger.warn('ModuleManager:start:already-started');
      return;
    }

    const order = this.resolveStartOrder();
    this.registerModules(order);
    const startSucceeded: string[] = [];
    const backgroundStarts: BackgroundStart[] = [];
    const logger = this.context.logger;

    try {
      for (const moduleId of order) {
        const record = this.modules.get(moduleId)!;
        const mod = record.module;
        if (mod.start) {
          if (mod.startMode === 'background') {
            backgroundStarts.push({ moduleId, module: mod });
            continue;
          }

          const t0 = this.context.now();
          logger.info('ModuleManager:start:start', { moduleId });

          await mod.start(this.context);

          logger.info('ModuleManager:start:done', { moduleId, durationMs: this.context.now() - t0 });
          startSucceeded.push(moduleId);
        }
      }

      this.started = true;

      for (const item of backgroundStarts) {
        this.startBackground(item.moduleId, item.module);
      }
    } catch (error) {
      logger.error('ModuleManager:start:failed', { error });

      await this.rollbackStops(startSucceeded);

      throw new CoreError({
        code: MM_START_FAILED,
        message: 'Runtime start failed.',
        cause: error,
        context: {
          startedModules: startSucceeded,
        },
      });
    }
  }

  private startBackground(moduleId: string, mod: RuntimeModule): void {
    const t0 = this.context.now();
    const logger = this.context.logger;

    void (async () => {
      try {
        await mod.start?.(this.context);
        logger.info('ModuleManager:start:background:done', { moduleId, durationMs: this.context.now() - t0 });
      } catch (error) {
        logger.warn('ModuleManager:start:background:failed', { moduleId, durationMs: this.context.now() - t0, error });
      }
    })();
  }

  private registerModules(order: string[]): void {
    const logger = this.context.logger;

    for (const moduleId of order) {
      const record = this.modules.get(moduleId)!;
      const mod = record.module;

      if (this.registered.has(moduleId) || !mod.register) continue;

      const t0 = this.context.now();
      logger.debug('ModuleManager:register:start', { moduleId });

      mod.register(this.context);

      logger.debug('ModuleManager:register:done', { moduleId, durationMs: this.context.now() - t0 });
      this.registered.add(moduleId);
    }
  }

  public async stop(): Promise<void> {
    if (!this.started) return;

    const logger = this.context.logger;

    const order = this.resolveStartOrder();

    for (let index = order.length - 1; index >= 0; index -= 1) {
      const moduleId = order[index];
      const record = this.modules.get(moduleId);
      const mod = record?.module;

      if (!mod?.stop) continue;

      const t0 = this.context.now();
      logger.info('ModuleManager:stop:start', { moduleId });

      try {
        await mod.stop(this.context);
        logger.info('ModuleManager:stop:done', { moduleId, durationMs: this.context.now() - t0 });
      } catch (error) {
        logger.warn('ModuleManager:stop:failed', { moduleId, error });
      }
    }

    this.started = false;
  }

  private async rollbackStops(startedModules: string[]): Promise<void> {
    const logger = this.context.logger;

    for (let index = startedModules.length - 1; index >= 0; index -= 1) {
      const moduleId = startedModules[index];
      const mod = this.modules.get(moduleId)?.module;
      if (!mod?.stop) continue;

      const t0 = this.context.now();
      logger.warn('ModuleManager:rollback-stop:start', { moduleId });

      try {
        await mod.stop(this.context);
        logger.warn('ModuleManager:rollback-stop:done', { moduleId, durationMs: this.context.now() - t0 });
      } catch (error) {
        logger.warn('ModuleManager:rollback-stop:failed', { moduleId, error });
      }
    }
  }

  private resolveStartOrder(): string[] {
    for (const [id, record] of this.modules.entries()) {
      for (const dep of record.dependencies) {
        if (!this.modules.has(dep)) {
          throw new CoreError({
            code: MM_MISSING_DEPENDENCY,
            message: `Missing dependency: ${id} -> ${dep}`,
            context: { moduleId: id, dependencyId: dep },
          });
        }
      }
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (id: string): void => {
      if (visited.has(id)) return;

      if (visiting.has(id)) {
        throw new CoreError({
          code: MM_CYCLE_DEPENDENCY,
          message: `Cycle dependency detected at: ${id}`,
          context: { at: id },
        });
      }

      visiting.add(id);
      const deps = this.modules.get(id)!.dependencies;
      for (const dep of deps) visit(dep);
      visiting.delete(id);

      visited.add(id);
      order.push(id);
    };

    // check for cycles and build order
    for (const id of this.modules.keys()) visit(id);

    return order;
  }
}
