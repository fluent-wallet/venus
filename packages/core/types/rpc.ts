export type JsonRpcId = number;

export type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

export type JsonRpcSuccessResponse<T = unknown> = {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result: T;
};

export type JsonRpcErrorResponse = {
  jsonrpc: '2.0';
  id: JsonRpcId | null;
  error: JsonRpcError;
};

export type JsonRpcResponse<T = unknown> = JsonRpcSuccessResponse<T> | JsonRpcErrorResponse;

export type ChainRpcRequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export interface IChainRpc {
  request<T = unknown>(method: string, params?: unknown, options?: ChainRpcRequestOptions): Promise<T>;
  batch<T = unknown>(requests: readonly { method: string; params?: unknown }[], options?: ChainRpcRequestOptions): Promise<T[]>;
}
