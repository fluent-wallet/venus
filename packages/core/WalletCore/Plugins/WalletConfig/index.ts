import events from '@core/WalletCore/Events';
import { type Subscription, catchError, debounceTime, interval, retry, startWith, switchMap, throwError, map, filter } from 'rxjs';
import type { Plugin } from '../';
import { networkRpcPrefixMap, type Network } from '@core/database/models/Network';
import { fetchChainMulticall } from '@cfx-kit/dapp-utils/dist/fetch';
import { getWalletConfig } from '../ReactInject/data/useWalletConfig';
import { configValueFormatters, configKeyList, defaultWalletConfigs, type WalletConfig } from './consts';
import { NetworksWithChainIdKey } from '@core/utils/consts';
import { createContract } from '@cfx-kit/dapp-utils/dist/contract';
import WalletConfigABI from '@core/contracts/ABI/WalletConfig';

const ONE_SECONDS = 1000;
const ONE_HOUR = 60 * 60 * ONE_SECONDS;

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    WalletConfig: WalletConfig;
  }
}

class WalletConfigPlugin implements Plugin {
  public name = 'WalletConfig';
  private _pollingSub: Subscription | null = null;

  constructor() {
    this._setup();
  }

  private _setup() {
    events.currentNetworkObservable
      .pipe(
        debounceTime(40),
        filter((i) => i !== null),
      )
      .subscribe((currentNetwork) => {
        // reset wallet config
        events.walletConfigSubjectPush.next(defaultWalletConfigs);
        this._startup(currentNetwork);
      });
  }

  private _startup(network: Network) {
    this._pollingSub?.unsubscribe();
    const networkConfig = NetworksWithChainIdKey[`${network.networkType}_${network.chainId}`];
    if (!networkConfig || !('multicallContractAddress' in networkConfig) || !('configContractAddress' in networkConfig)) return;
    const { multicallContractAddress, configContractAddress } = networkConfig;
    const walletConfigContract = createContract({ address: configContractAddress, ABI: WalletConfigABI });
    const rpcPrefix = networkRpcPrefixMap[network.networkType];
    this._pollingSub = interval(ONE_HOUR)
      .pipe(
        startWith(0),
        switchMap(() => {
          return fetchChainMulticall({
            url: network.endpoint,
            method: `${rpcPrefix}_call`,
            multicallContractAddress,
            data: configKeyList.map((key) => {
              const formatter = configValueFormatters[key as 'pendingPollingInterval'];
              return {
                contractAddress: walletConfigContract.address,
                encodedData: walletConfigContract.encodeFunctionData('get', [key]),
                decodeFunc: (v) => (v === '' ? null : formatter(walletConfigContract.decodeFunctionResult('get', v)[0])),
              };
            }),
          });
        }),
        catchError((err) => {
          console.error('get wallet config error: ', err);
          return throwError(() => err);
        }),
        retry({ delay: ONE_SECONDS }),
        map((configValues) => {
          const _configs = getWalletConfig();
          const configs = { ..._configs };
          configKeyList.forEach((key, index) => {
            const value = configValues[index];
            if (value !== null) {
              configs[key as 'pendingPollingInterval'] = value;
            }
          });
          return configs;
        }),
      )
      .subscribe((res) => {
        events.walletConfigSubjectPush.next(res);
      });
  }
}

export default new WalletConfigPlugin();
