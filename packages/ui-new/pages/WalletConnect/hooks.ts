import Plugins from '@core/WalletCore/Plugins';
import { NetworkType, useCurrentAddress, useCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject';
import { useNavigation } from '@react-navigation/native';
import {
  StackNavigation,
  WalletConnectStackName,
  WalletConnectLoadingStackName,
  WalletConnectProposalStackName,
  WalletConnectSignMessageStackName,
  WalletConnectEOATransactionStackName,
  WalletCOnnectContractTransactionStackName,
} from '@router/configs';
import { useCallback, useEffect, useState } from 'react';
import { uniq } from 'lodash-es';
import { CFX_ESPACE_MAINNET_NETID, CFX_ESPACE_TESTNET_NETID } from '@core/utils/consts';
import { isDev, isQA } from '@utils/getEnv';
import { queryNetworks } from '@core/database/models/Network/query';
import Methods from '@core/WalletCore/Methods';
import { WalletConnectPluginEventMethod } from '@core/WalletCore/Plugins/WalletConnect/types';

const SUPPORT_NETWORK = [CFX_ESPACE_MAINNET_NETID];
const QA_SUPPORT_NETWORK = [CFX_ESPACE_MAINNET_NETID, CFX_ESPACE_TESTNET_NETID];

export function useListenWalletConnectEvent() {
  const navigation = useNavigation<StackNavigation>();
  const currentAddress = useCurrentAddress();
  const currentNetwork = useCurrentNetwork();

  useEffect(() => {
    const subject = Plugins.WalletConnect.events.subscribe(async (event) => {
      const { type } = event;
      if (type === WalletConnectPluginEventMethod.LOADING && event.data === true) {
        navigation.navigate(WalletConnectStackName, { screen: WalletConnectLoadingStackName });
      }

      if (type === WalletConnectPluginEventMethod.SESSION_PROPOSAL) {
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
      }

      // show sign message
      if (type === WalletConnectPluginEventMethod.SIGN_MESSAGE) {
        const { address } = event.data;
        if (address !== currentAddress?.hex) {
          return event.data.reject('address is not match');
        }
        const chainId = event.data.chainId.split(':')[1];

        if (chainId !== currentNetwork?.netId.toString()) {
          return event.data.reject('network is not match');
        }
        navigation.navigate(WalletConnectStackName, { screen: WalletConnectSignMessageStackName, params: event.data });
      }

      // show send transaction
      if (type === WalletConnectPluginEventMethod.SEND_TRANSACTION) {
        const {
          reject,
          address,
          tx: { to, data },
        } = event.data;

        if (address !== currentAddress?.hex) {
          return reject('address is not match');
        }
        const chainId = event.data.chainId.split(':')[1];

        if (chainId !== currentNetwork?.netId.toString()) {
          return reject('network is not match');
        }

        const isContract = await Methods.checkIsContractAddress({
          networkType: currentNetwork.networkType,
          endpoint: currentNetwork.endpoint,
          addressValue: to,
        });

        if ((!isContract && !!to) || !data || data === '0x') {
          navigation.navigate(WalletConnectStackName, { screen: WalletConnectEOATransactionStackName, params: event.data });
        } else {
          navigation.navigate(WalletConnectStackName, { screen: WalletCOnnectContractTransactionStackName, params: event.data });
        }
      }
    });

    return () => {
      subject.unsubscribe();
    };
  }, [navigation, currentAddress, currentNetwork]);
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
