import Plugins from '@core/WalletCore/Plugins';
import { useNavigation } from '@react-navigation/native';
import { StackNavigation, WalletConnectStackName, WalletConnectLoadingStackName, WalletConnectProposalStackName } from '@router/configs';
import { useEffect } from 'react';
import { filter } from 'rxjs';

export default function useListenWalletConnectEvent() {
  const navigation = useNavigation<StackNavigation>();

  useEffect(() => {
    const $loading = Plugins.WalletConnect.subscribeLoading()
      .pipe(filter((bl) => bl === true))
      .subscribe(() => {
        navigation.navigate(WalletConnectStackName, { screen: WalletConnectLoadingStackName });
      });
    const $sessionProposal = Plugins.WalletConnect.getSubscribeWCProposal().subscribe((args) => {
      navigation.navigate(WalletConnectStackName, { screen: WalletConnectProposalStackName, params: args  });
    });

    return () => {
      $loading.unsubscribe();
      $sessionProposal.unsubscribe();
    };
  }, [navigation]);
}
