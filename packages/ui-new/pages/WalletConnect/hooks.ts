import Plugins from '@core/WalletCore/Plugins';
import { NetworkType } from '@core/WalletCore/Plugins/ReactInject';
import { useNavigation } from '@react-navigation/native';
import { StackNavigation, WalletConnectStackName, WalletConnectLoadingStackName, WalletConnectProposalStackName } from '@router/configs';
import { useCallback, useEffect, useState } from 'react';
import { filter } from 'rxjs';
import { uniq } from 'lodash-es';
import { CFX_ESPACE_MAINNET_NETID, CFX_ESPACE_TESTNET_NETID } from '@core/utils/consts';
import { isDev, isQA } from '@utils/getEnv';
import { queryNetworks } from '@core/database/models/Network/query';

const SUPPORT_NETWORK = [CFX_ESPACE_MAINNET_NETID];
const QA_SUPPORT_NETWORK = [CFX_ESPACE_MAINNET_NETID, CFX_ESPACE_TESTNET_NETID];

export function useListenWalletConnectEvent() {
  const navigation = useNavigation<StackNavigation>();

  useEffect(() => {
    // show loading
    const $loading = Plugins.WalletConnect.getWCLoadingSubscribe()
      .pipe(filter((bl) => bl === true))
      .subscribe(() => {
        navigation.navigate(WalletConnectStackName, { screen: WalletConnectLoadingStackName });
      });

    // show proposal
    const $sessionProposal = Plugins.WalletConnect.getWCProposalSubscribe().subscribe(async (args) => {
      let requestChains = uniq([...(args.requiredNamespaces?.eip155?.chains || []), ...(args.optionalNamespaces?.eip155?.chains || [])]).map((chain) =>
        parseInt(chain.split('eip155:')[1]),
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
        return args.reject('UNSUPPORTED_CHAINS');
      }
      navigation.navigate(WalletConnectStackName, { screen: WalletConnectProposalStackName, params: { ...args, chains: requestChains } });
    });

    return () => {
      $loading.unsubscribe();
      $sessionProposal.unsubscribe();
    };
  }, [navigation]);
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
