import { fromFetch } from 'rxjs/fetch';

export interface RPCResponse<T> {
  id: number;
  jsonrpc: string;
  result: T;
  error?: {
    code: number;
    data: string;
    message: string;
  };
}

let rpcId = 0;
export const RPCSend = <T>(endpoint: string, args: { method: string; params?: any } | { method: string; params?: any }[]) => {
  const bodyParams = () => ({
    jsonrpc: '2.0',
    id: rpcId++,
  });
  return fromFetch<T>(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(Array.isArray(args) ? args.map((v) => ({ ...bodyParams(), ...v })) : { ...bodyParams(), ...args }),
    selector: (response) => response.json(),
  });
};

export const RPCSendFactory = (endpoint: string) => {
  return RPCSend.bind(null, endpoint) as <T>(args: Parameters<typeof RPCSend>[1]) => ReturnType<typeof RPCSend<T>>;
};
