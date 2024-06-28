interface ProviderRPCError extends Error {
  message: string;
  code: number;
  data?: unknown;
}

/** standard RPC Error */
export class ParseError extends Error implements ProviderRPCError {
  message = 'Parse error';
  code = -32700;
}

export class InvalidRequestError extends Error implements ProviderRPCError {
  message = 'Invalid request';
  code = -32600;
}

export class MethodNotFoundError extends Error implements ProviderRPCError {
  message = 'Method not found';
  code = -32601;
}

export class InvalidParamsError extends Error implements ProviderRPCError {
  message = 'Invalid params';
  code = -32602;
}

export class InternalError extends Error implements ProviderRPCError {
  message = 'Internal error';
  code = -32603;
}

/** non-standard RPC Error */
export class InvalidInputError extends Error implements ProviderRPCError {
  message = 'Invalid input';
  code = -32000;
}

export class ResourceNotFoundError extends Error implements ProviderRPCError {
  message = 'Resource not found';
  code = -32001;
}

export class ResourceUnavailableError extends Error implements ProviderRPCError {
  message = 'Resource unavailable';
  code = -32002;
}

export class TransactionRejectedError extends Error implements ProviderRPCError {
  message = 'Transaction rejected';
  code = -32003;
}

export class MethodNotSupportedError extends Error implements ProviderRPCError {
  message = 'Method not supported';
  code = -32004;
}

export class LimitExceededError extends Error implements ProviderRPCError {
  message = 'Limit exceeded';
  code = -32005;
}

export class JSONRPCBersionError extends Error implements ProviderRPCError {
  message = 'JSON-RPC version not supported';
  code = -32006;
}

/** provider Error */
export class UserRejectedRequestError extends Error implements ProviderRPCError {
  message = 'User Rejected Request';
  code = 4001;
}

export class UnauthorizedError extends Error implements ProviderRPCError {
  message = 'Unauthorized';
  code = 4100;
}

/** The Provider does not support the requested method. */
export class UnsupportedMethodError extends Error implements ProviderRPCError {
  message = 'Unsupported Method';
  code = 4200;
}

/** The Provider is disconnected from all chains. */
export class DisconnectedError extends Error implements ProviderRPCError {
  message = 'Disconnected';
  code = 4900;
}

/** The Provider is not connected to the requested chain. */
export class ChainDisconnectedError extends Error implements ProviderRPCError {
  message = 'Chain Disconnected';
  code = 4901;
}

/**
 * 4900 is intended to indicate that the Provider is disconnected from all chains,
 * while 4901 is intended to indicate that the Provider is disconnected from a specific chain only.
 * In other words, 4901 implies that the Provider is connected to other chains, just not the requested one.
 */
