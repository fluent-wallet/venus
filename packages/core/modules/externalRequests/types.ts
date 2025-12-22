export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ExternalRequestSnapshot =
  | {
      provider: 'wallet-connect';
      kind: 'session_proposal';
      proposalId: string;
      origin: string;
      metadata: {
        name: string;
        url: string;
        icons?: string[];
      };
      requiredNamespaces: JsonValue;
      optionalNamespaces?: JsonValue;
    }
  | {
      provider: 'wallet-connect';
      kind: 'session_request';
      sessionId: string;
      origin: string;
      chainId: string;
      method: 'personal_sign' | 'eth_signTypedData_v4' | 'eth_sendTransaction';
      params: JsonValue;
    };
