import { CoreError } from './CoreError';

export function invariant(condition: unknown, error: CoreError | (() => CoreError)): asserts condition {
  if (condition) return;
  throw typeof error === 'function' ? error() : error;
}

export type AssertJsonValueOptions = {
  code: string;
  message?: string;
};

export function assertJsonValue(value: unknown, options: AssertJsonValueOptions): void {
  const seen = new WeakSet<object>();

  const fail = (path: string, reason: string): never => {
    throw new CoreError({
      code: options.code,
      message: options.message ?? 'Value is not JSON-serializable.',
      context: { path, reason },
    });
  };

  const visit = (current: unknown, path: string): void => {
    if (current === null) return;

    switch (typeof current) {
      case 'string':
      case 'boolean':
        return;

      case 'number':
        if (!Number.isFinite(current)) fail(path, 'Non-finite number.');
        return;

      case 'undefined':
        fail(path, 'Undefined is not JSON.');
        return;

      case 'bigint':
        fail(path, 'BigInt is not JSON.');
        return;

      case 'function':
        fail(path, 'Function is not JSON.');
        return;

      case 'symbol':
        fail(path, 'Symbol is not JSON.');
        return;

      case 'object': {
        const objectValue = current as object;

        if (seen.has(objectValue)) fail(path, 'Circular reference.');
        seen.add(objectValue);

        if (Array.isArray(current)) {
          for (let index = 0; index < current.length; index += 1) {
            visit(current[index], `${path}[${index}]`);
          }
          return;
        }

        const proto = Object.getPrototypeOf(current);
        if (proto !== Object.prototype && proto !== null) {
          fail(path, 'Non-plain object (class instance, Date/Map/Set/Model, etc.).');
        }

        for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
          visit(child, `${path}.${key}`);
        }
        return;
      }

      default:
        fail(path, 'Unsupported type.');
    }
  };

  visit(value, '$');
}
