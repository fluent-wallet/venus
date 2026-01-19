import { CHAIN_RPC_ABORTED, CHAIN_RPC_ERROR_RESPONSE, CHAIN_RPC_HTTP_ERROR, CHAIN_RPC_INVALID_RESPONSE, CHAIN_RPC_TIMEOUT, type CoreError } from '@core/errors';
import { HttpJsonRpcClient } from './HttpJsonRpcClient';

const createJsonResponse = (json: unknown, overrides: Partial<Response> = {}): Response => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: jest.fn().mockResolvedValue(json),
    ...overrides,
  } as unknown as Response;
};

const createAbortableFetch = (): jest.Mock => {
  return jest.fn().mockImplementation((_input: unknown, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        return;
      }

      signal?.addEventListener(
        'abort',
        () => {
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        },
        { once: true },
      );
    });
  });
};

describe('HttpJsonRpcClient', () => {
  const endpoint = 'https://rpc.example';

  it('request(): returns result on success', async () => {
    const fetchFn = jest.fn().mockResolvedValue(createJsonResponse({ jsonrpc: '2.0', id: 1, result: '0x1' }));
    const client = new HttpJsonRpcClient(endpoint, { fetchFn });

    await expect(client.request('eth_blockNumber')).resolves.toBe('0x1');
  });

  it('request(): throws CHAIN_RPC_ERROR_RESPONSE on rpc error', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32000, message: 'boom' },
      }),
    );

    const client = new HttpJsonRpcClient(endpoint, { fetchFn });

    await expect(client.request('eth_blockNumber')).rejects.toMatchObject<Partial<CoreError>>({
      code: CHAIN_RPC_ERROR_RESPONSE,
    });
  });

  it('request(): throws CHAIN_RPC_HTTP_ERROR on non-2xx', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse(
        { jsonrpc: '2.0', id: 1, result: '0x1' },
        {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        },
      ),
    );

    const client = new HttpJsonRpcClient(endpoint, { fetchFn });

    await expect(client.request('eth_blockNumber')).rejects.toMatchObject<Partial<CoreError>>({
      code: CHAIN_RPC_HTTP_ERROR,
    });
  });

  it('request(): throws CHAIN_RPC_INVALID_RESPONSE on invalid shape', async () => {
    const fetchFn = jest.fn().mockResolvedValue(createJsonResponse({ foo: 'bar' }));
    const client = new HttpJsonRpcClient(endpoint, { fetchFn });

    await expect(client.request('eth_blockNumber')).rejects.toMatchObject<Partial<CoreError>>({
      code: CHAIN_RPC_INVALID_RESPONSE,
    });
  });

  it('request(): throws CHAIN_RPC_ABORTED and does not call fetch when signal already aborted', async () => {
    const fetchFn = jest.fn();
    const client = new HttpJsonRpcClient(endpoint, { fetchFn });

    const controller = new AbortController();
    controller.abort();

    await expect(client.request('eth_blockNumber', [], { signal: controller.signal })).rejects.toMatchObject<Partial<CoreError>>({
      code: CHAIN_RPC_ABORTED,
    });

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('request(): throws CHAIN_RPC_TIMEOUT when timeoutMs elapses', async () => {
    jest.useFakeTimers();

    const fetchFn = createAbortableFetch();
    const client = new HttpJsonRpcClient(endpoint, { fetchFn });

    const promise = client.request('eth_blockNumber', [], { timeoutMs: 10 });

    jest.advanceTimersByTime(20);

    await expect(promise).rejects.toMatchObject<Partial<CoreError>>({
      code: CHAIN_RPC_TIMEOUT,
    });

    jest.useRealTimers();
  });

  it('batch(): returns results in request order (response can be out of order)', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse([
        { jsonrpc: '2.0', id: 2, result: 'b' },
        { jsonrpc: '2.0', id: 1, result: 'a' },
      ]),
    );

    const client = new HttpJsonRpcClient(endpoint, { fetchFn });

    await expect(
      client.batch([
        { method: 'm1', params: [] },
        { method: 'm2', params: [] },
      ]),
    ).resolves.toEqual(['a', 'b']);
  });

  it('batch(): throws CHAIN_RPC_ERROR_RESPONSE and includes errors[] summary', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      createJsonResponse([
        { jsonrpc: '2.0', id: 1, result: 'a' },
        { jsonrpc: '2.0', id: 2, error: { code: -32000, message: 'boom' } },
      ]),
    );

    const client = new HttpJsonRpcClient(endpoint, { fetchFn });

    await expect(client.batch([{ method: 'm1' }, { method: 'm2' }])).rejects.toMatchObject({
      code: CHAIN_RPC_ERROR_RESPONSE,
      context: {
        firstError: { id: 2, method: 'm2', code: -32000, message: 'boom' },
      },
    });
  });

  it('batch(): throws CHAIN_RPC_INVALID_RESPONSE when response is missing an id', async () => {
    const fetchFn = jest.fn().mockResolvedValue(createJsonResponse([{ jsonrpc: '2.0', id: 1, result: 'a' }]));
    const client = new HttpJsonRpcClient(endpoint, { fetchFn });

    await expect(client.batch([{ method: 'm1' }, { method: 'm2' }])).rejects.toMatchObject<Partial<CoreError>>({
      code: CHAIN_RPC_INVALID_RESPONSE,
    });
  });
});
