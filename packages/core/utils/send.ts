// import { enrichFetch } from './index';
import {
  CFX_ESPACE_MAINNET_CHAINID,
  CFX_ESPACE_MAINNET_SCAN,
  CFX_ESPACE_MAINNET_SCAN_OPENAPI,
  CFX_ESPACE_TESTNET_CHAINID,
  CFX_ESPACE_TESTNET_SCAN,
  CFX_ESPACE_TESTNET_SCAN_OPENAPI,
} from '@core/Consts/network';
import database from '@core/DB';
import { querySelectedNetwork } from '@core/DB/models/Network/service';
import { throwError } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { map, switchMap } from 'rxjs/operators';

export interface RPCResponse<T> {
  id: number;
  jsonrpc: string;
  result: T;
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
  return RPCSend.bind(null, endpoint);
};

// host is scan open api
export const scanOpenAPISend = <T>(url: string, options: RequestInit = {}) => {
  return querySelectedNetwork(database)
    .observe()
    .pipe(
      map((network) => network[0]),
      switchMap((network) => {
        if (network.chainId === CFX_ESPACE_MAINNET_CHAINID || network.chainId === CFX_ESPACE_TESTNET_CHAINID) {
          return fromFetch<T>(
            `${network.chainId === CFX_ESPACE_MAINNET_CHAINID ? CFX_ESPACE_MAINNET_SCAN_OPENAPI : CFX_ESPACE_TESTNET_SCAN_OPENAPI}${
              url.startsWith('/') ? url : `/${url}`
            }`,
            {
              selector: (res) => res.json(),
              headers: {
                'Content-Type': 'application/json',
              },
              ...options,
            }
          );
        }
        return throwError(() => new Error('scanAPISend not support this network'));
      })
    );
};

// host is scan 
export const scanAPISend = <T>(url: string, options: RequestInit = {}) => {
  return querySelectedNetwork(database)
    .observe()
    .pipe(
      map((network) => network[0]),
      switchMap((network) => {
        if (network.chainId === CFX_ESPACE_MAINNET_CHAINID || network.chainId === CFX_ESPACE_TESTNET_CHAINID) {
          return fromFetch<T>(
            `${network.chainId === CFX_ESPACE_MAINNET_CHAINID ? CFX_ESPACE_MAINNET_SCAN : CFX_ESPACE_TESTNET_SCAN}${url.startsWith('/') ? url : `/${url}`}`,
            {
              selector: (res) => res.json(),
              headers: {
                'Content-Type': 'application/json',
              },
              ...options,
            }
          );
        }
        return throwError(() => new Error('scanAPISend not support this network'));
      })
    );
};
