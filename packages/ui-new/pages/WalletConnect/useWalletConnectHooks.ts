import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { useCurrentAddressValue, useCurrentNetwork, isPendingTxsFull, NetworkType } from '@core/WalletCore/Plugins/ReactInject';
import { WalletConnectPluginEventType } from '@core/WalletCore/Plugins/WalletConnect/types';
import { Networks } from '@core/utils/consts';
import { StackActions, useNavigation } from '@react-navigation/native';
import {
  HomeStackName,
  WalletConnectProposalStackName,
  WalletConnectSignMessageStackName,
  WalletConnectStackName,
  WalletConnectTransactionStackName,
  TooManyPendingStackName,
  type StackNavigation,
} from '@router/configs';
import backToHome, { getActiveRouteName } from '@utils/backToHome';
import { isProd, isQA } from '@utils/getEnv';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { parseNamespaceData, ChainPrefix, ExtractCip155Namespace, type Namespace } from '@cfx-kit/react-utils/dist/WalletConnectorHelper';

const openNetworks = isProd ? ([Networks['Conflux eSpace']] as const) : isQA ? ([Networks['Conflux eSpace'], Networks['eSpace Testnet']] as const) : null;

export function useListenWalletConnectEvent() {
  const navigation = useNavigation<StackNavigation>();
  const currentAddressValue = useCurrentAddressValue();
  const currentNetwork = useCurrentNetwork()!;

  useEffect(() => {
    const subject = plugins.WalletConnect.currentEventSubject.subscribe(async (event) => {
      if (event === undefined) {
        return;
      }
      if (event === null) {
        backToHome(navigation);
        return;
      }

      const activeRouterName = getActiveRouteName(navigation.getState());
      const needDispatch = activeRouterName !== HomeStackName;

      const navigateMethod = !needDispatch
        ? navigation.navigate
        : (stackName: string, params?: any) => navigation?.dispatch(StackActions.replace(stackName, params));

      const { type } = event;

      switch (type) {
        case WalletConnectPluginEventType.SESSION_PROPOSAL: {
          const connectedNetworks = openNetworks
            ? event.data?.connectedNetworks?.filter((network) =>
                openNetworks?.some((net) => net.netId === network.netId && net.networkType === network.networkType),
              )
            : event.data.connectedNetworks;

          if (connectedNetworks.length === 0) {
            return event.action.reject('UNSUPPORTED_CHAINS');
          }

          navigateMethod(WalletConnectStackName, {
            screen: WalletConnectProposalStackName,
            params: {
              ...event.data,
              connectedNetworks,
            },
          });
          break;
        }

        case WalletConnectPluginEventType.SIGN_MESSAGE: {
          const chainId = event.data.chainId.split(':')[1];

          if (chainId !== currentNetwork?.netId.toString()) {
            return event.action.reject('network is not match');
          }
          navigateMethod(WalletConnectStackName, { screen: WalletConnectSignMessageStackName, params: event.data });
          break;
        }

        case WalletConnectPluginEventType.SEND_TRANSACTION: {
          if (isPendingTxsFull()) {
            return navigateMethod(TooManyPendingStackName);
          }

          const {
            tx: { to, data },
          } = event.data;
          const chainId = event.data.chainId.split(':')[1];

          if (chainId !== currentNetwork?.netId.toString()) {
            return event.action.reject('network is not match');
          }

          // if to address is undefined, it is contract create
          let isContract = typeof to === 'undefined';

          if (typeof to !== 'undefined') {
            isContract = await methods.checkIsContractAddress({
              networkType: currentNetwork.networkType,
              endpoint: currentNetwork.endpoint,
              addressValue: to,
            });
          }

          const EOATx = (!isContract && !!to) || !data || data === '0x';

          navigateMethod(WalletConnectStackName, {
            screen: WalletConnectTransactionStackName,
            params: { ...event.data, isContract: !EOATx },
          });
          break;
        }
      }
    });

    return () => {
      subject.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAddressValue, currentNetwork?.id]);
}

export function useWalletConnectSessions(filterByAddress?: string | undefined | null) {
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof plugins.WalletConnect.getAllSession>>[string][]>([]);
  const currentNetwork = useCurrentNetwork()!;

  const getSessions = useCallback(async () => {
    const sessions = await plugins.WalletConnect.getAllSession();
    setSessions(
      Object.values(sessions).map((session) => ({
        ...session,
        namespaces: ExtractCip155Namespace(session.namespaces as Record<string, Namespace>) as unknown as typeof session.namespaces,
      })),
    );
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    getSessions();
    const sub = plugins.WalletConnect.getWCSessionChangeSubscribe().subscribe(getSessions);

    return () => {
      sub.unsubscribe();
    };
  }, []);

  return useMemo(() => {
    const res = sessions?.map?.((session) => ({
      ...session,
      namespaces: {
        ...session.namespaces,
        ...(session.namespaces[ChainPrefix.EIP]
          ? {
              [ChainPrefix.EIP]: {
                ...session.namespaces[ChainPrefix.EIP],
                accounts: session.namespaces[ChainPrefix.EIP].accounts?.map(parseNamespaceData),
                chains: session.namespaces[ChainPrefix.EIP].chains?.map(parseNamespaceData),
              },
            }
          : null),
        ...(session.namespaces[ChainPrefix.CIP]
          ? {
              [ChainPrefix.CIP]: {
                ...session.namespaces[ChainPrefix.CIP],
                accounts: session.namespaces[ChainPrefix.CIP].accounts?.map(parseNamespaceData),
                chains: session.namespaces[ChainPrefix.CIP].chains?.map(parseNamespaceData),
              },
            }
          : null),
      },
    }));
    if (!currentNetwork) return [];

    if (filterByAddress) {
      return res.filter((session) =>
        session.namespaces[currentNetwork.networkType === NetworkType.Ethereum ? ChainPrefix.EIP : ChainPrefix.CIP]?.accounts.find(
          (account) => account.address.toLowerCase() === filterByAddress.toLowerCase() && Number(account.chainId) === currentNetwork.netId,
        ),
      );
    }
    return res;
  }, [filterByAddress, sessions, currentNetwork?.id]);
}
