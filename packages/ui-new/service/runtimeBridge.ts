import type { ExternalRequestSnapshot } from '@core/modules/externalRequests';
import { parseEvmRpcTransactionRequest } from '@core/services/transaction';
import { StackActions } from '@react-navigation/native';
import {
  ExternalInputHandlerStackName,
  PasswordVerifyStackName,
  type StackNavigation,
  TooManyPendingStackName,
  WalletConnectProposalStackName,
  WalletConnectSignMessageStackName,
  WalletConnectStackName,
  WalletConnectTransactionStackName,
} from '@router/configs';
import { useQueryClient } from '@tanstack/react-query';
import { getActiveRouteName } from '@utils/backToHome';
import { useEffect, useRef } from 'react';
import { getAccountRootKey, getCurrentAccountKey } from './account';
import { getAssetRootKey, getAssetsByAddressKey } from './asset';
import {
  getAccountService,
  getAddressValidationService,
  getAuthService,
  getExternalRequestsService,
  getNetworkService,
  getRuntimeEventBus,
  getTransactionService,
  type IAccount,
  type IAsset,
} from './core';
import { getNetworkRootKey } from './network';
import { getNftRootKey } from './nft';
import { getSignatureRootKey } from './signature';
import { getTransactionRootKey } from './transaction';

export const getWalletConnectRootKey = () => ['walletConnect'] as const;

type RuntimeWcSessionRequest = Extract<ExternalRequestSnapshot, { provider: 'wallet-connect'; kind: 'session_request' }>;
type RuntimeWcSignMessageRequest = RuntimeWcSessionRequest & {
  method: 'personal_sign' | 'eth_signTypedData' | 'eth_signTypedData_v3' | 'eth_signTypedData_v4';
};
type RuntimeWcSendTxRequest = RuntimeWcSessionRequest & { method: 'eth_sendTransaction' };

function isRuntimeWcSignMessageRequest(req: RuntimeWcSessionRequest): req is RuntimeWcSignMessageRequest {
  return req.method === 'personal_sign' || req.method === 'eth_signTypedData' || req.method === 'eth_signTypedData_v3' || req.method === 'eth_signTypedData_v4';
}

function isRuntimeWcSendTxRequest(req: RuntimeWcSessionRequest): req is RuntimeWcSendTxRequest {
  return req.method === 'eth_sendTransaction';
}

export function useRuntimeEventBridge(navigation: StackNavigation) {
  const queryClient = useQueryClient();
  const eventBus = getRuntimeEventBus();
  const auth = getAuthService();
  const externalRequests = getExternalRequestsService();

  const activePasswordRequestIdRef = useRef<string | null>(null);
  const routedRequestIdsRef = useRef<Set<string>>(new Set());
  const MAX_ROUTED_REQUEST_IDS = 100;

  useEffect(() => {
    const syncCurrentAccount = (payload: { account: IAccount }) => {
      if (payload.account) {
        queryClient.setQueryData(getCurrentAccountKey(), payload.account);
      }

      void queryClient.invalidateQueries({ queryKey: getAccountRootKey(), refetchType: 'inactive' });
    };

    const invalidateNetworkRelated = () => {
      void queryClient.invalidateQueries({ queryKey: getNetworkRootKey() });
      void queryClient.invalidateQueries({ queryKey: getAccountRootKey() });
      void queryClient.invalidateQueries({ queryKey: getAssetRootKey() });
      void queryClient.invalidateQueries({ queryKey: getTransactionRootKey() });
      void queryClient.invalidateQueries({ queryKey: getSignatureRootKey() });
    };

    const invalidateTx = () => {
      void queryClient.invalidateQueries({ queryKey: getTransactionRootKey() });
    };

    const invalidateSignature = () => {
      void queryClient.invalidateQueries({ queryKey: getSignatureRootKey() });
    };

    const invalidateAsset = () => {
      void queryClient.invalidateQueries({ queryKey: getAssetRootKey() });
    };

    const syncAssetSnapshot = (payload: { key: { addressId: string }; snapshot: { assets: IAsset[] } }) => {
      queryClient.setQueryData(getAssetsByAddressKey(payload.key.addressId), payload.snapshot.assets);
    };

    const invalidateWalletConnect = () => {
      void queryClient.invalidateQueries({ queryKey: getWalletConnectRootKey() });
    };

    const invalidateNft = () => {
      void queryClient.invalidateQueries({ queryKey: getNftRootKey() });
    };

    const handlePasswordRequested = (payload: { requestId: string; kind: 'password' | 'biometrics' }) => {
      if (payload.kind !== 'password') return;

      // Keep the latest request id so we can cancel on unmount (navigation teardown).
      activePasswordRequestIdRef.current = payload.requestId;

      navigation.navigate(PasswordVerifyStackName, { requestId: payload.requestId });
    };

    const handleExternalRequest = (payload: { requestId: string; request: ExternalRequestSnapshot }) => {
      const req = payload.request;

      // Only route WalletConnect requests here; other providers should be handled elsewhere.
      if (req.provider !== 'wallet-connect') return;

      if (routedRequestIdsRef.current.has(payload.requestId)) return;
      if (routedRequestIdsRef.current.size >= MAX_ROUTED_REQUEST_IDS) {
        // Prune oldest half to keep memory bounded.
        const iter = routedRequestIdsRef.current.values();
        for (let i = 0; i < Math.floor(MAX_ROUTED_REQUEST_IDS / 2); i += 1) {
          const next = iter.next();
          if (next.done) break;
          routedRequestIdsRef.current.delete(next.value);
        }
      }
      routedRequestIdsRef.current.add(payload.requestId);

      const activeRouterName = getActiveRouteName(navigation.getState());
      const shouldReplaceLinking = activeRouterName === ExternalInputHandlerStackName;

      if (req.kind === 'session_proposal') {
        const route = {
          name: WalletConnectStackName,
          params: { screen: WalletConnectProposalStackName, params: { requestId: payload.requestId, request: req } },
        } as const;

        if (shouldReplaceLinking) navigation.dispatch(StackActions.replace(route.name, route.params));
        else navigation.navigate(route.name, route.params);
        return;
      }

      if (req.kind === 'session_request') {
        if (isRuntimeWcSignMessageRequest(req)) {
          const route = {
            name: WalletConnectStackName,
            params: { screen: WalletConnectSignMessageStackName, params: { requestId: payload.requestId, request: req } },
          } as const;

          if (shouldReplaceLinking) navigation.dispatch(StackActions.replace(route.name, route.params));
          else navigation.navigate(route.name, route.params);
          return;
        }

        if (isRuntimeWcSendTxRequest(req)) {
          const handleSendTxRequest = async () => {
            try {
              const account = await getAccountService().getCurrentAccount();
              const addressId = account?.currentAddressId ?? null;
              if (addressId && (await getTransactionService().isPendingTxsFull({ addressId }))) {
                if (shouldReplaceLinking) {
                  navigation.dispatch(StackActions.replace(TooManyPendingStackName, { requestId: payload.requestId }));
                } else {
                  navigation.navigate(TooManyPendingStackName, { requestId: payload.requestId });
                }
                return;
              }
            } catch {
              // Fallback to normal flow; the transaction screen/service will handle errors if needed.
            }

            let isContract = true;
            try {
              const tx = parseEvmRpcTransactionRequest(req.params);
              const to = tx.to;
              const data = tx.data;
              if (!to) {
                isContract = true;
              } else {
                const network = await getNetworkService().getCurrentNetwork();
                const contract = await getAddressValidationService().isContractAddress({
                  networkType: network.networkType,
                  chainId: network.chainId,
                  addressValue: to,
                });
                const EOATx = (!contract && !!to) || !data || data === '0x';
                isContract = !EOATx;
              }
            } catch {
              // ignore and keep default
            }

            const route = {
              name: WalletConnectStackName,
              params: { screen: WalletConnectTransactionStackName, params: { requestId: payload.requestId, request: req, isContract } },
            } as const;

            if (shouldReplaceLinking) navigation.dispatch(StackActions.replace(route.name, route.params));
            else navigation.navigate(route.name, route.params);
          };

          // Preserve legacy behavior: block dApp sendTx when pending queue is full.
          // We do the check here so we can route to an in-app UI instead of silently rejecting.
          void handleSendTxRequest().catch((error) => console.log(error));
          return;
        }
      }
    };

    const subs = [
      eventBus.on('account/current-changed', syncCurrentAccount),
      eventBus.on('network/current-changed', invalidateNetworkRelated),

      eventBus.on('tx/created', invalidateTx),
      eventBus.on('tx/updated', invalidateTx),

      eventBus.on('signature/changed', invalidateSignature),

      eventBus.on('assets-sync/succeeded', syncAssetSnapshot),
      eventBus.on('receive-assets-sync/succeeded', invalidateAsset),

      eventBus.on('wallet-connect/sessions-changed', invalidateWalletConnect),

      eventBus.on('nft-sync/started', invalidateNft),
      eventBus.on('nft-sync/updated', invalidateNft),
      eventBus.on('nft-sync/succeeded', invalidateNft),
      eventBus.on('nft-sync/failed', invalidateNft),

      eventBus.on('auth/credential-requested', handlePasswordRequested),

      eventBus.on('external-requests/requested', handleExternalRequest),
    ];

    try {
      const active = externalRequests.getActiveRequests({ provider: 'wallet-connect' });
      for (const item of active) handleExternalRequest(item);
    } catch {
      // ignore
    }

    return () => {
      for (const sub of subs) sub.unsubscribe();

      const active = activePasswordRequestIdRef.current;
      activePasswordRequestIdRef.current = null;

      if (active) {
        auth.cancelPasswordRequest({ requestId: active });
      }
    };
  }, [auth, eventBus, externalRequests, navigation, queryClient]);
}
