import Plugins from '@core/WalletCore/Plugins';
import { useNavigation } from '@react-navigation/native';
import { StackNavigation, WalletConnectStackName, WalletConnectLoadingStackName, WalletConnectProposalStackName } from '@router/configs';
import { useCallback, useEffect, useState } from 'react';
import { filter } from 'rxjs';

export function useListenWalletConnectEvent() {
  const navigation = useNavigation<StackNavigation>();

  useEffect(() => {
    const $loading = Plugins.WalletConnect.getWCLoadingSubscribe()
      .pipe(filter((bl) => bl === true))
      .subscribe(() => {
        navigation.navigate(WalletConnectStackName, { screen: WalletConnectLoadingStackName });
      });
    const $sessionProposal = Plugins.WalletConnect.getWCProposalSubscribe().subscribe((args) => {
      navigation.navigate(WalletConnectStackName, { screen: WalletConnectProposalStackName, params: args });
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
