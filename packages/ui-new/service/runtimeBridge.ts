import type { ExternalRequestSnapshot } from '@core/modules/externalRequests';
import {
  PasswordVerifyStackName,
  type StackNavigation,
  WalletConnectProposalStackName,
  WalletConnectSignMessageStackName,
  WalletConnectStackName,
  WalletConnectTransactionStackName,
} from '@router/configs';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getAccountRootKey } from './account';
import { getAssetRootKey } from './asset';
import { getAuthService, getRuntimeEventBus } from './core';
import { getNetworkRootKey } from './network';
import { getNftRootKey } from './nft';
import { getSignatureRootKey } from './signature';
import { getTransactionRootKey } from './transaction';

export const getWalletConnectRootKey = () => ['walletConnect'] as const;

type RuntimeWcSessionRequest = Extract<ExternalRequestSnapshot, { provider: 'wallet-connect'; kind: 'session_request' }>;
type RuntimeWcSignMessageRequest = RuntimeWcSessionRequest & { method: 'personal_sign' | 'eth_signTypedData_v4' };
type RuntimeWcSendTxRequest = RuntimeWcSessionRequest & { method: 'eth_sendTransaction' };

function isRuntimeWcSignMessageRequest(req: RuntimeWcSessionRequest): req is RuntimeWcSignMessageRequest {
  return req.method === 'personal_sign' || req.method === 'eth_signTypedData_v4';
}

function isRuntimeWcSendTxRequest(req: RuntimeWcSessionRequest): req is RuntimeWcSendTxRequest {
  return req.method === 'eth_sendTransaction';
}

export function useRuntimeEventBridge(navigation: StackNavigation) {
  const queryClient = useQueryClient();
  const eventBus = getRuntimeEventBus();
  const auth = getAuthService();

  const activePasswordRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    const invalidateAccountRelated = () => {
      void queryClient.invalidateQueries({ queryKey: getAccountRootKey() });
      void queryClient.invalidateQueries({ queryKey: getAssetRootKey() });
      void queryClient.invalidateQueries({ queryKey: getTransactionRootKey() });
      void queryClient.invalidateQueries({ queryKey: getSignatureRootKey() });
    };

    const invalidateNetworkRelated = () => {
      void queryClient.invalidateQueries({ queryKey: getNetworkRootKey() });
      void queryClient.invalidateQueries({ queryKey: getAssetRootKey() });
      void queryClient.invalidateQueries({ queryKey: getTransactionRootKey() });
      void queryClient.invalidateQueries({ queryKey: getSignatureRootKey() });
    };

    const invalidateTx = () => {
      void queryClient.invalidateQueries({ queryKey: getTransactionRootKey() });
    };

    const invalidateAsset = () => {
      void queryClient.invalidateQueries({ queryKey: getAssetRootKey() });
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

      if (req.kind === 'session_proposal') {
        navigation.navigate(WalletConnectStackName, {
          screen: WalletConnectProposalStackName,
          params: { requestId: payload.requestId, request: req },
        });
        return;
      }

      if (req.kind === 'session_request') {
        if (isRuntimeWcSignMessageRequest(req)) {
          navigation.navigate(WalletConnectStackName, {
            screen: WalletConnectSignMessageStackName,
            params: { requestId: payload.requestId, request: req },
          });
          return;
        }

        if (isRuntimeWcSendTxRequest(req)) {
          navigation.navigate(WalletConnectStackName, {
            screen: WalletConnectTransactionStackName,
            params: { requestId: payload.requestId, request: req },
          });
        }
      }
    };

    const subs = [
      eventBus.on('account/current-changed', invalidateAccountRelated),
      eventBus.on('network/current-changed', invalidateNetworkRelated),

      eventBus.on('tx/created', invalidateTx),
      eventBus.on('tx/updated', invalidateTx),

      eventBus.on('assets-sync/started', invalidateAsset),
      eventBus.on('assets-sync/updated', invalidateAsset),
      eventBus.on('assets-sync/succeeded', invalidateAsset),
      eventBus.on('assets-sync/failed', invalidateAsset),

      eventBus.on('receive-assets-sync/started', invalidateAsset),
      eventBus.on('receive-assets-sync/succeeded', invalidateAsset),
      eventBus.on('receive-assets-sync/failed', invalidateAsset),

      eventBus.on('wallet-connect/sessions-changed', invalidateWalletConnect),

      eventBus.on('nft-sync/started', invalidateNft),
      eventBus.on('nft-sync/updated', invalidateNft),
      eventBus.on('nft-sync/succeeded', invalidateNft),
      eventBus.on('nft-sync/failed', invalidateNft),

      eventBus.on('auth/credential-requested', handlePasswordRequested),

      eventBus.on('external-requests/requested', handleExternalRequest),
    ];

    return () => {
      for (const sub of subs) sub.unsubscribe();

      const active = activePasswordRequestIdRef.current;
      activePasswordRequestIdRef.current = null;

      if (active) {
        auth.cancelPasswordRequest({ requestId: active });
      }
    };
  }, [auth, eventBus, navigation, queryClient]);
}
