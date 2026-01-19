import { CHAIN_RPC_ABORTED, CHAIN_RPC_ERROR_RESPONSE, CHAIN_RPC_HTTP_ERROR, CHAIN_RPC_INVALID_RESPONSE, CHAIN_RPC_TIMEOUT, CoreError } from '@core/errors';
import type { ChainRpcRequestOptions, IChainRpc, JsonRpcError, JsonRpcId, JsonRpcRequest, JsonRpcResponse } from '@core/types';

export type HttpJsonRpcFetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type HttpJsonRpcClientOptions = {
  fetchFn?: HttpJsonRpcFetchFn;
  headers?: Record<string, string>;
};

type JsonRpcBatchItem = { method: string; params?: unknown };

type PostMeta = {
  endpoint: string;
  methods: string[];
  requestIds: number[];
};

type NormalizedRpcError = { code: number; message: string; data?: unknown };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isJsonRpcError(value: unknown): value is JsonRpcError {
  return isObject(value) && typeof value.code === 'number' && typeof value.message === 'string';
}

function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  if (!isObject(value)) return false;
  if (value.jsonrpc !== '2.0') return false;

  const id = value.id;
  const idOk = typeof id === 'number' || id === null;
  if (!idOk) return false;

  const hasResult = 'result' in value;
  const hasError = 'error' in value;

  if (hasResult === hasError) return false;
  if (hasError && !isJsonRpcError(value.error)) return false;

  return true;
}

function normalizeJsonRpcError(error: JsonRpcError): NormalizedRpcError {
  return { code: error.code, message: error.message, data: error.data };
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  return false;
}

export class HttpJsonRpcClient implements IChainRpc {
  private nextId: JsonRpcId = 1;
  private readonly endpoint: string;
  private readonly fetchFn: HttpJsonRpcFetchFn;
  private readonly headers: Record<string, string>;

  constructor(endpoint: string, options: HttpJsonRpcClientOptions = {}) {
    if (!endpoint) {
      throw new Error('HttpJsonRpcClient: endpoint is required');
    }

    const defaultFetch = typeof globalThis.fetch === 'function' ? (globalThis.fetch.bind(globalThis) as HttpJsonRpcFetchFn) : undefined;

    if (!options.fetchFn && !defaultFetch) {
      throw new Error('HttpJsonRpcClient: fetch is not available; please provide options.fetchFn');
    }

    this.endpoint = endpoint;
    this.fetchFn = options.fetchFn ?? (defaultFetch as HttpJsonRpcFetchFn);
    this.headers = options.headers ?? {};
  }

  async request<T = unknown>(method: string, params?: unknown, options?: ChainRpcRequestOptions): Promise<T> {
    const requestId = this.nextId++;
    const payload: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      ...(params === undefined ? {} : { params }),
    };

    const raw = await this.fetchJsonRpc(payload, { methods: [method], requestIds: [requestId] }, options);
    const response = this.parseJsonRpcResponse(raw, { methods: [method], requestIds: [requestId] });

    if ('error' in response) {
      throw new CoreError({
        code: CHAIN_RPC_ERROR_RESPONSE,
        message: 'JSON-RPC error response.',
        context: {
          endpoint: this.endpoint,
          method,
          requestId,
          rpcError: normalizeJsonRpcError(response.error),
        },
      });
    }

    return response.result as T;
  }

  async batch<T = unknown>(requests: readonly JsonRpcBatchItem[], options?: ChainRpcRequestOptions): Promise<T[]> {
    if (requests.length === 0) return [];

    const requestIds: number[] = [];
    const methods: string[] = [];

    const payload: JsonRpcRequest[] = requests.map((item) => {
      const requestId = this.nextId++;
      requestIds.push(requestId);
      methods.push(item.method);

      return {
        jsonrpc: '2.0',
        id: requestId,
        method: item.method,
        ...(item.params === undefined ? {} : { params: item.params }),
      };
    });

    const raw = await this.fetchJsonRpc(payload, { methods, requestIds }, options);
    const responses = this.parseJsonRpcResponses(raw, { methods, requestIds });

    const byId = new Map<number, JsonRpcResponse>();
    for (const resp of responses) {
      if (resp.id === null) {
        throw new CoreError({
          code: CHAIN_RPC_INVALID_RESPONSE,
          message: 'Invalid JSON-RPC response: batch item has null id.',
          context: { endpoint: this.endpoint },
        });
      }

      if (byId.has(resp.id)) {
        throw new CoreError({
          code: CHAIN_RPC_INVALID_RESPONSE,
          message: 'Invalid JSON-RPC response: duplicate id in batch response.',
          context: { endpoint: this.endpoint, requestId: resp.id },
        });
      }

      byId.set(resp.id, resp);
    }

    const expected = new Set(requestIds);
    for (const id of byId.keys()) {
      if (!expected.has(id)) {
        throw new CoreError({
          code: CHAIN_RPC_INVALID_RESPONSE,
          message: 'Invalid JSON-RPC response: unexpected id in batch response.',
          context: { endpoint: this.endpoint, requestId: id },
        });
      }
    }

    const errors: Array<{ id: number; method: string; code: number; message: string }> = [];
    const results: T[] = [];

    for (let index = 0; index < requestIds.length; index += 1) {
      const requestId = requestIds[index];
      const method = methods[index];
      const resp = byId.get(requestId);

      if (!resp) {
        throw new CoreError({
          code: CHAIN_RPC_INVALID_RESPONSE,
          message: 'Invalid JSON-RPC response: missing batch item response.',
          context: { endpoint: this.endpoint, method, requestId },
        });
      }

      if ('error' in resp) {
        errors.push({ id: requestId, method, code: resp.error.code, message: resp.error.message });
        continue;
      }

      results.push(resp.result as T);
    }

    if (errors.length > 0) {
      throw new CoreError({
        code: CHAIN_RPC_ERROR_RESPONSE,
        message: 'JSON-RPC batch error response.',
        context: {
          endpoint: this.endpoint,
          requestCount: requestIds.length,
          firstError: errors[0],
          errors,
        },
      });
    }

    return results;
  }

  private parseJsonRpcResponse(raw: unknown, meta: Pick<PostMeta, 'methods' | 'requestIds'>): JsonRpcResponse {
    if (!isJsonRpcResponse(raw)) {
      throw new CoreError({
        code: CHAIN_RPC_INVALID_RESPONSE,
        message: 'Invalid JSON-RPC response shape.',
        context: { endpoint: this.endpoint, method: meta.methods[0], requestId: meta.requestIds[0] },
      });
    }

    if (raw.id !== meta.requestIds[0]) {
      throw new CoreError({
        code: CHAIN_RPC_INVALID_RESPONSE,
        message: 'Invalid JSON-RPC response id.',
        context: { endpoint: this.endpoint, method: meta.methods[0], requestId: meta.requestIds[0], actualId: raw.id },
      });
    }

    return raw;
  }

  private parseJsonRpcResponses(raw: unknown, meta: Pick<PostMeta, 'methods' | 'requestIds'>): JsonRpcResponse[] {
    if (!Array.isArray(raw)) {
      throw new CoreError({
        code: CHAIN_RPC_INVALID_RESPONSE,
        message: 'Invalid JSON-RPC batch response: expected array.',
        context: { endpoint: this.endpoint, requestCount: meta.requestIds.length },
      });
    }

    const responses: JsonRpcResponse[] = [];
    for (const item of raw) {
      if (!isJsonRpcResponse(item)) {
        throw new CoreError({
          code: CHAIN_RPC_INVALID_RESPONSE,
          message: 'Invalid JSON-RPC batch response item shape.',
          context: { endpoint: this.endpoint, requestCount: meta.requestIds.length },
        });
      }
      responses.push(item);
    }

    return responses;
  }

  private async fetchJsonRpc(payload: unknown, meta: Pick<PostMeta, 'methods' | 'requestIds'>, options?: ChainRpcRequestOptions): Promise<unknown> {
    const { signal, timeoutMs } = options ?? {};

    if (signal?.aborted) {
      throw new CoreError({
        code: CHAIN_RPC_ABORTED,
        message: 'JSON-RPC request aborted.',
        context: { endpoint: this.endpoint, methods: meta.methods, requestIds: meta.requestIds },
      });
    }

    const controller = signal || timeoutMs !== undefined ? new AbortController() : null;
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const onAbort = () => {
      try {
        controller?.abort();
      } catch {
        // ignore
      }
    };

    if (controller && signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    if (controller && timeoutMs !== undefined) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        try {
          controller.abort();
        } catch {
          // ignore
        }
      }, timeoutMs);
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json',
      ...this.headers,
    };

    let body: string;
    try {
      body = JSON.stringify(payload);
    } catch (error) {
      throw new CoreError({
        code: CHAIN_RPC_INVALID_RESPONSE,
        message: 'Failed to serialize JSON-RPC request body.',
        cause: error,
        context: { endpoint: this.endpoint, methods: meta.methods, requestIds: meta.requestIds },
      });
    }

    try {
      const response = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers,
        body,
        signal: controller?.signal,
      });

      if (!response.ok) {
        throw new CoreError({
          code: CHAIN_RPC_HTTP_ERROR,
          message: 'HTTP error while calling JSON-RPC endpoint.',
          context: {
            endpoint: this.endpoint,
            methods: meta.methods,
            requestIds: meta.requestIds,
            httpStatus: response.status,
          },
        });
      }

      try {
        return await response.json();
      } catch (error) {
        throw new CoreError({
          code: CHAIN_RPC_INVALID_RESPONSE,
          message: 'Failed to parse JSON-RPC response body as JSON.',
          cause: error,
          context: { endpoint: this.endpoint, methods: meta.methods, requestIds: meta.requestIds },
        });
      }
    } catch (error) {
      if (error instanceof CoreError) throw error;

      if (timedOut) {
        throw new CoreError({
          code: CHAIN_RPC_TIMEOUT,
          message: 'JSON-RPC request timed out.',
          cause: error,
          context: { endpoint: this.endpoint, methods: meta.methods, requestIds: meta.requestIds, timeoutMs },
        });
      }

      if (isAbortError(error) || controller?.signal.aborted) {
        throw new CoreError({
          code: CHAIN_RPC_ABORTED,
          message: 'JSON-RPC request aborted.',
          cause: error,
          context: { endpoint: this.endpoint, methods: meta.methods, requestIds: meta.requestIds },
        });
      }

      throw new CoreError({
        code: CHAIN_RPC_HTTP_ERROR,
        message: 'Network error while calling JSON-RPC endpoint.',
        cause: error,
        context: { endpoint: this.endpoint, methods: meta.methods, requestIds: meta.requestIds },
      });
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (controller && signal) {
        signal.removeEventListener('abort', onAbort);
      }
    }
  }
}
