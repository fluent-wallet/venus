import Plugins from '@core/WalletCore/Plugins';
import { NetworkType, useCurrentAddressValue, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { useNavigation } from '@react-navigation/native';
import {
  StackNavigation,
  WalletConnectStackName,
  WalletConnectLoadingStackName,
  WalletConnectProposalStackName,
  WalletConnectSignMessageStackName,
  WalletConnectTransactionStackName,
} from '@router/configs';
import { useCallback, useEffect, useState } from 'react';
import { uniq } from 'lodash-es';
import { CFX_ESPACE_MAINNET_NETID, CFX_ESPACE_TESTNET_NETID } from '@core/utils/consts';
import { isDev, isQA } from '@utils/getEnv';
import { queryNetworks } from '@core/database/models/Network/query';
import methods from '@core/WalletCore/Methods';
import { WalletConnectPluginEventType } from '@core/WalletCore/Plugins/WalletConnect/types';

const SUPPORT_NETWORK = [CFX_ESPACE_MAINNET_NETID];
const QA_SUPPORT_NETWORK = [CFX_ESPACE_MAINNET_NETID, CFX_ESPACE_TESTNET_NETID];

function useListenWalletConnectEvent() {
  const navigation = useNavigation<StackNavigation>();
  const currentAddressValue = useCurrentAddressValue();
  const currentNetwork = useCurrentNetwork();

  useEffect(() => {
    const subject = Plugins.WalletConnect.events.subscribe(async (event) => {
      const { type } = event;
      switch (type) {
        case WalletConnectPluginEventType.LOADING: {
          if (event.data) {
            navigation.navigate(WalletConnectStackName, { screen: WalletConnectLoadingStackName });
          }
          break;
        }

        case WalletConnectPluginEventType.SESSION_PROPOSAL: {
          let requestChains = uniq([...(event.data.requiredNamespaces?.eip155?.chains || []), ...(event.data.optionalNamespaces?.eip155?.chains || [])]).map(
            (chain) => parseInt(chain.split('eip155:')[1]),
          );
          if (isDev) {
            // dev support all network
            const networks = await queryNetworks();
            const EVMNetwork = networks.filter((net) => net.networkType === NetworkType.Ethereum);

            requestChains = requestChains.filter((chain) => EVMNetwork.find((net) => net.netId === chain));
          } else if (isQA) {
            requestChains = requestChains.filter((chains) => QA_SUPPORT_NETWORK.includes(chains));
          } else {
            requestChains = requestChains.filter((chains) => SUPPORT_NETWORK.includes(chains));
          }
          if (requestChains.length === 0) {
            return event.data.reject('UNSUPPORTED_CHAINS');
          }
          navigation.navigate(WalletConnectStackName, { screen: WalletConnectProposalStackName, params: { ...event.data, chains: requestChains } });
          break;
        }

        case WalletConnectPluginEventType.SIGN_MESSAGE: {
          const { address } = event.data;
          if (address !== currentAddressValue) {
            return event.data.reject('address is not match');
          }
          const chainId = event.data.chainId.split(':')[1];

          if (chainId !== currentNetwork?.netId.toString()) {
            return event.data.reject('network is not match');
          }
          navigation.navigate(WalletConnectStackName, { screen: WalletConnectSignMessageStackName, params: event.data });
          break;
        }

        case WalletConnectPluginEventType.SEND_TRANSACTION: {
          const {
            reject,
            address,
            tx: { to, data },
          } = event.data;
          if (address !== currentAddressValue) {
            return reject('address is not match');
          }
          const chainId = event.data.chainId.split(':')[1];

          if (chainId !== currentNetwork?.netId.toString()) {
            return reject('network is not match');
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

          navigation.navigate(WalletConnectStackName, {
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

export function useWalletConnectSessions() {
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof Plugins.WalletConnect.getAllSession>>[string][]>([]);

  const getSessions = useCallback(async () => {
    const sessions = await Plugins.WalletConnect.getAllSession();
    setSessions(Object.values(sessions));
  }, []);

  useEffect(() => {
    Plugins.WalletConnect.getAllSession().then((res) => {
      setSessions(Object.values(res));
    });
  }, []);

  useEffect(() => {
    const sub = Plugins.WalletConnect.getWCSessionChangeSubscribe().subscribe(getSessions);

    return () => {
      sub.unsubscribe();
    };
  }, [getSessions]);

  return { sessions };
}


export default useListenWalletConnectEvent;