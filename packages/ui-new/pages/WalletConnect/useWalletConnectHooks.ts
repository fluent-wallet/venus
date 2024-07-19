import methods from '@core/WalletCore/Methods';
import plugins from '@core/WalletCore/Plugins';
import { NetworkType, useCurrentAddressValue, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { WalletConnectPluginEventType } from '@core/WalletCore/Plugins/WalletConnect/types';
import { queryNetworks } from '@core/database/models/Network/query';
import { Networks } from '@core/utils/consts';
import { StackActions, useNavigation } from '@react-navigation/native';
import {
  HomeStackName,
  WalletConnectProposalStackName,
  WalletConnectSignMessageStackName,
  WalletConnectStackName,
  WalletConnectTransactionStackName,
  type StackNavigation,
} from '@router/configs';
import backToHome, { getActiveRouteName } from '@utils/backToHome';
import { isDev, isQA } from '@utils/getEnv';
import { uniq } from 'lodash-es';
import { useCallback, useEffect, useState } from 'react';

const SUPPORT_NETWORK = [Networks['Conflux eSpace'].netId] as Array<number>;
const QA_SUPPORT_NETWORK = [Networks['Conflux eSpace'].netId, Networks['eSpace Testnet'].netId] as Array<number>;

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
        : (stackName: string, params: any) => navigation?.dispatch(StackActions.replace(stackName, params));

      const { type } = event;
      switch (type) {
        case WalletConnectPluginEventType.SESSION_PROPOSAL: {
          let requestChains = uniq([...(event.data.requiredNamespaces?.eip155?.chains || []), ...(event.data.optionalNamespaces?.eip155?.chains || [])]).map(
            (chain) => Number.parseInt(chain.split('eip155:')[1]),
          );
          const networks = await queryNetworks();
          if (isDev) {
            // dev support all network
            const EVMNetwork = networks.filter((net) => net.networkType === NetworkType.Ethereum);

            requestChains = requestChains.filter((chain) => EVMNetwork.find((net) => net.netId === chain));
          } else if (isQA) {
            requestChains = requestChains.filter((chains) => QA_SUPPORT_NETWORK.includes(chains));
          } else {
            requestChains = requestChains.filter((chains) => SUPPORT_NETWORK.includes(chains));
          }
          if (requestChains.length === 0) {
            return event.action.reject('UNSUPPORTED_CHAINS');
          }
          navigateMethod(WalletConnectStackName, {
            screen: WalletConnectProposalStackName,
            params: {
              ...event.data,
              connectedNetworks: networks
                .filter((network) => requestChains.includes(network.netId))
                .map((network) => ({ icon: network.icon!, name: network.name, netId: network.netId, id: network.id })),
            },
          });
          break;
        }

        case WalletConnectPluginEventType.SIGN_MESSAGE: {
          const { address } = event.data;
          if (address !== currentAddressValue) {
            return event.action.reject('address is not match');
          }
          const chainId = event.data.chainId.split(':')[1];

          if (chainId !== currentNetwork?.netId.toString()) {
            return event.action.reject('network is not match');
          }
          navigateMethod(WalletConnectStackName, { screen: WalletConnectSignMessageStackName, params: event.data });
          break;
        }

        case WalletConnectPluginEventType.SEND_TRANSACTION: {
          const {
            address,
            tx: { to, data },
          } = event.data;

          if (address !== currentAddressValue) {
            return event.action.reject('address is not match');
          }
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

  const getSessions = useCallback(async () => {
    const sessions = await plugins.WalletConnect.getAllSession();
    setSessions(Object.values(sessions));
  }, []);

  useEffect(() => {
    plugins.WalletConnect.getAllSession().then((res) => {
      setSessions(Object.values(res));
    });
  }, []);

  useEffect(() => {
    const sub = plugins.WalletConnect.getWCSessionChangeSubscribe().subscribe(getSessions);

    return () => {
      sub.unsubscribe();
    };
  }, [getSessions]);

  if (filterByAddress) {
    return {
      sessions: sessions.filter((session) => {
        const { namespaces } = session;
        return namespaces?.eip155?.accounts.find((account) => {
          const [eip, chainId, address] = account.split(':');
          return address.toLowerCase() === filterByAddress.toLowerCase();
        });
      }),
    };
  }

  return { sessions };
}
