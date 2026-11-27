import MulticallABI from '@core/contracts/ABI/Multicall';
import WalletConfigABI from '@core/contracts/ABI/WalletConfig';
import { type Network, networkRpcPrefixMap, networkRpcSuffixMap } from '@core/database/models/Network';
import { HttpJsonRpcClient } from '@core/rpc';
import { NetworksWithChainIdKey } from '@core/utils/consts';
import type { EventBus } from '@core/WalletCore/Events';
import { SERVICE_IDENTIFIER } from '@core/WalletCore/service';
import { Interface } from 'ethers';
import { inject, injectable } from 'inversify';
import { catchError, debounceTime, filter, interval, map, retry, type Subscription, startWith, switchMap, throwError } from 'rxjs';
import { currentNetworkObservable } from '../ReactInject/data/useCurrentNetwork';
import { getWalletConfig } from '../ReactInject/data/useWalletConfig';
import { configKeyList, configValueFormatters, defaultWalletConfigs, type WalletConfig } from './consts';

const ONE_SECONDS = 1000;
const ONE_HOUR = 60 * 60 * ONE_SECONDS;
const walletConfigInterface = new Interface(WalletConfigABI);
const multicallInterface = new Interface(MulticallABI);

export const WALLET_CONFIG_EVENT = 'WalletConfigEvent';

declare module '../../Events/eventTypes.ts' {
  interface EventMap {
    [WALLET_CONFIG_EVENT]: WalletConfig;
  }
}

@injectable()
export class WalletConfigServer {
  public name = 'WalletConfig';
  private _pollingSub: Subscription | null = null;

  @inject(SERVICE_IDENTIFIER.EVENT_BUS)
  eventBus!: EventBus;

  _setup() {
    currentNetworkObservable
      .pipe(
        debounceTime(40),
        filter((i) => i !== null),
      )
      .subscribe((currentNetwork) => {
        // reset wallet config
        this.eventBus.dispatch(WALLET_CONFIG_EVENT, defaultWalletConfigs);
        this._startup(currentNetwork);
      });
  }

  private _startup(network: Network) {
    this._pollingSub?.unsubscribe();
    const networkConfig = NetworksWithChainIdKey[`${network.networkType}_${network.chainId}`];
    if (!networkConfig || !('multicallContractAddress' in networkConfig) || !('configContractAddress' in networkConfig)) return;
    const { multicallContractAddress, configContractAddress } = networkConfig;
    const rpcPrefix = networkRpcPrefixMap[network.networkType];
    this._pollingSub = interval(ONE_HOUR)
      .pipe(
        startWith(0),
        switchMap(async () => {
          const raw = await new HttpJsonRpcClient(network.endpoint).request<string>(`${rpcPrefix}_call`, [
            {
              to: multicallContractAddress,
              data: multicallInterface.encodeFunctionData('aggregate', [
                configKeyList.map((key) => [configContractAddress, walletConfigInterface.encodeFunctionData('get', [key])]),
              ]),
            },
            networkRpcSuffixMap[network.networkType],
          ]);
          const values = multicallInterface.decodeFunctionResult('aggregate', raw)[1];
          return configKeyList.map((key, index) => {
            const value: string = values[index];
            return value === '0x' || value === '' ? null : configValueFormatters[key](walletConfigInterface.decodeFunctionResult('get', value)[0]);
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
        this.eventBus.dispatch(WALLET_CONFIG_EVENT, res);
      });
  }
}
