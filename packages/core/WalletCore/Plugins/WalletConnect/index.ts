import '@walletconnect/react-native-compat';
import { Core } from '@walletconnect/core';
import { Web3Wallet, type Web3WalletTypes } from '@walletconnect/web3wallet';
import { buildApprovedNamespaces, getSdkError, type BuildApprovedNamespacesParams } from '@walletconnect/utils';
import { mergeMap, map, combineLatest, from, scan, distinctUntilChanged, filter, debounceTime } from 'rxjs';
import { isEqual } from 'lodash-es';
import { NetworkType } from './../../../database/models/Network';
import { RequestType } from './../../../database/models/Request/RequestType';
import { addressesObservable } from '../../Plugins/ReactInject/data/useAddresses';
import { networksObservable } from '../../Plugins/ReactInject/data/useNetworks';
import { type Plugin } from '../../Plugins';
import methods from '../../Methods';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    WalletConnect: WalletConnectPluginClass;
  }
}

class WalletConnectPluginClass implements Plugin {
  public name = 'WalletConnect';
  core = new Core({
    projectId: '77ffee6a4cbf8ed25550cea82939d1fa',
  });
  web3wallet!: Awaited<ReturnType<typeof Web3Wallet.init>>;
  private initPromise: Promise<any>;

  constructor() {
    const hexAddressObservable = addressesObservable.pipe(
      mergeMap((addresses) => from(addresses)),
      map((address) => address.hex),
      scan((acc, hex) => {
        if (!acc.includes(hex)) {
          return [...acc, hex];
        }
        return acc;
      }, [] as Array<string>),
      distinctUntilChanged((prev, curr) => isEqual(prev, curr)),
    );

    const netIdsObservable = networksObservable.pipe(
      mergeMap((networks) => from(networks)),
      filter((network) => network.networkType === NetworkType.Ethereum),
      map((network) => network.netId),
      scan((acc, netId) => {
        if (!acc.includes(netId)) {
          return [...acc, netId];
        }
        return acc;
      }, [] as Array<number>),
      distinctUntilChanged((prev, curr) => isEqual(prev, curr)),
    );

    this.initPromise = Web3Wallet.init({
      core: this.core, // <- pass the shared `core` instance
      metadata: {
        name: 'SwiftShield Wallet',
        description: 'SwiftShield Wallet to interface with Dapps',
        url: 'https://swiftshield.tech/',
        icons: [],
      },
    })
      .then((web3Wallet) => {
        this.web3wallet = web3Wallet;
        console.log('init success');

        combineLatest([hexAddressObservable, netIdsObservable])
          .pipe(
            filter((tuple) => tuple.every((ele) => ele?.length > 0)),
            debounceTime(40),
          )
          .subscribe(([hexAddresses, netIds]) => {
            const supportedNamespaces = {
              eip155: {
                chains: netIds.map((netId) => `eip155:${netId}`),
                methods: ['eth_sendTransaction', 'personal_sign'],
                events: ['accountsChanged', 'chainChanged'],
                accounts: netIds.map((netId) => hexAddresses.map((hexAddress) => `eip155:${netId}:${hexAddress}`)).flat(),
              },
            };
            this.web3wallet.on('session_proposal', (proposal) => this.onSessionProposal({ ...proposal, supportedNamespaces }));
          });
      })
      .catch((err) => {
        console.log('init error', err);
      });
  }

  private onSessionProposal = async ({
    id,
    params,
    supportedNamespaces,
  }: Web3WalletTypes.SessionProposal & { supportedNamespaces: BuildApprovedNamespacesParams['supportedNamespaces'] }) => {
    const proposer = params.proposer;
    if (!proposer.publicKey) return;
    let app = await methods.isAppExist(proposer.publicKey);
    if (!app) {
      app = await methods.createApp({
        identity: proposer.publicKey,
        name: proposer.metadata.name,
        ...(proposer.metadata.icons?.[0] ? { icon: proposer.metadata.icons[0] } : null),
        ...(proposer.metadata.url ? { origin: proposer.metadata.url } : null),
      });
    }
    const request = await methods.createRequest({
      app,
      type: RequestType.WalletConnectProposal,
    });
    console.log(request);

    try {
      // ------- namespaces builder util ------------ //
      const approvedNamespaces = buildApprovedNamespaces({
        proposal: params,
        supportedNamespaces,
      });

      // ------- end namespaces builder util ------------ //
      const session = await this.web3wallet.approveSession({
        id,
        namespaces: approvedNamespaces,
      });
      console.log('session start', id, params);
      console.log('session', session);
    } catch (error) {
      // use the error.message to show toast/info-box letting the user know that the connection attempt was unsuccessful
      console.log('reject session', error);

      await this.web3wallet.rejectSession({
        id,
        reason: getSdkError('USER_REJECTED'),
      });
    }
  };

  public pair = async (uri: string) => {
    await this.initPromise;
    if (!this.web3wallet) {
      throw new Error('WalletConnect init failed!');
    }
    return this.web3wallet.core.pairing.pair({ uri });
  };
}

export default new WalletConnectPluginClass();
