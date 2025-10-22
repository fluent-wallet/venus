export type AsyncQueue = {
  enqueue<T>(operation: () => Promise<T>): Promise<T>;
  flush(): Promise<void>;
  reset(): void;
};

export const createAsyncQueue = (): AsyncQueue => {
  type Task = {
    operation: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  };

  const tasks: Task[] = [];
  let processing = false;
  let flushPromise: Promise<void> | null = null;
  let flushResolver: (() => void) | null = null;

  const resolveFlush = () => {
    if (flushResolver) {
      flushResolver();
      flushResolver = null;
      flushPromise = null;
    }
  };

  const run = async () => {
    while (tasks.length > 0) {
      const task = tasks.shift()!;
      try {
        const result = await task.operation();
        task.resolve(result);
      } catch (error) {
        task.reject(error);
      }
    }

    processing = false;
    resolveFlush();
  };

  const ensureProcessing = () => {
    if (!processing) {
      processing = true;
      void run().catch(() => {
        processing = false;
        resolveFlush();
      });
    }
  };

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      tasks.push({
        operation: () => operation() as Promise<unknown>,
        resolve: (value) => resolve(value as T),
        reject,
      });
      ensureProcessing();
    });
  };

  const flush = async (): Promise<void> => {
    if (!processing && tasks.length === 0) {
      return;
    }

    if (!flushPromise) {
      flushPromise = new Promise<void>((resolve) => {
        flushResolver = resolve;
      });
    }

    await flushPromise;
  };

  const reset = () => {
    if (tasks.length > 0) {
      const error = new Error('Queue reset');
      while (tasks.length > 0) {
        const task = tasks.shift()!;
        task.reject(error);
      }
    }
    resolveFlush();
  };

  return { enqueue, flush, reset };
};
