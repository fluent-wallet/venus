import { Core } from '@walletconnect/core';
import { Web3Wallet, type Web3WalletTypes } from '@walletconnect/web3wallet';
import { buildApprovedNamespaces, getSdkError, type BuildApprovedNamespacesParams } from '@walletconnect/utils';
import { mergeMap, map, combineLatest, from, scan, distinctUntilChanged, filter, debounceTime, firstValueFrom } from 'rxjs';
import { isEqual } from 'lodash-es';
import { NetworkType } from './../../../database/models/Network';
import { RequestType } from './../../../database/models/Request/RequestType';
import { addressesObservable } from '../../Plugins/ReactInject/data/useAddresses';
import { networksObservable } from '../../Plugins/ReactInject/data/useNetworks';
import { type Plugin } from '../../Plugins';
import methods from '../../Methods';
import { currentAddressObservable, getCurrentAddress } from '../ReactInject/data/useCurrentAddress';
import { currentAccountObservable } from '../ReactInject/data/useCurrentAccount';
import { isAddress } from 'ethers';

declare module '../../../WalletCore/Plugins' {
  interface Plugins {
    WalletConnect: WalletConnectPluginClass;
  }
}

export enum WalletConnectRPCMethod {
  Sign = 'eth_sign',
  PersonalSign = 'personal_sign',
  SignTypedData = 'eth_signTypedData',
  SendTransaction = 'eth_sendTransaction',
  SignTransaction = 'eth_signTransaction',
  SignTypedDataV4 = 'eth_signTypedData_v4',
}

class WalletConnectPluginClass implements Plugin {
  public name = 'WalletConnect';

  walletConnectCore = new Core({
    projectId: '77ffee6a4cbf8ed25550cea82939d1fa',
  });

  web3wallet = Web3Wallet.init({
    core: this.walletConnectCore, // <- pass the shared `core` instance
    metadata: {
      name: 'SwiftShield Wallet',
      description: 'SwiftShield Wallet to interface with Dapps',
      url: 'https://swiftshield.tech/',
      icons: [],
    },
  });

  supportedSigningMethods = [
    // WalletConnectRPCMethod.Sign, // see : https://support.metamask.io/hc/en-us/articles/14764161421467-What-is-eth-sign-and-why-is-it-a-risk
    WalletConnectRPCMethod.PersonalSign,
    WalletConnectRPCMethod.SignTypedData,
    WalletConnectRPCMethod.SignTypedDataV4
  ];
  supportedTransactionMethods = [WalletConnectRPCMethod.SendTransaction];

  supportedRPCMethods = [...this.supportedSigningMethods, ...this.supportedTransactionMethods];

  constructor() {
    this.initListeners();

    // const hexAddressObservable = addressesObservable.pipe(
    //   mergeMap((addresses) => from(addresses)),
    //   map((address) => address.hex),
    //   scan((acc, hex) => {
    //     if (!acc.includes(hex)) {
    //       return [...acc, hex];
    //     }
    //     return acc;
    //   }, [] as Array<string>),
    //   distinctUntilChanged((prev, curr) => isEqual(prev, curr)),
    // );

    // const netIdsObservable = networksObservable.pipe(
    //   mergeMap((networks) => from(networks)),
    //   filter((network) => network.networkType === NetworkType.Ethereum),
    //   map((network) => network.netId),
    //   scan((acc, netId) => {
    //     if (!acc.includes(netId)) {
    //       return [...acc, netId];
    //     }
    //     return acc;
    //   }, [] as Array<number>),
    //   distinctUntilChanged((prev, curr) => isEqual(prev, curr)),
    // );

    // Web3Wallet.init({
    //   core: this.walletConnectCore, // <- pass the shared `core` instance
    //   metadata: {
    //     name: 'SwiftShield Wallet',
    //     description: 'SwiftShield Wallet to interface with Dapps',
    //     url: 'https://swiftshield.tech/',
    //     icons: [],
    //   },
    // })
    //   .then((web3Wallet) => {
    //     this.web3wallet = web3Wallet;
    //     console.log('init success');

    //     combineLatest([hexAddressObservable, netIdsObservable])
    //       .pipe(
    //         filter((tuple) => tuple.every((ele) => ele?.length > 0)),
    //         debounceTime(40),
    //       )
    //       .subscribe(([hexAddresses, netIds]) => {
    //         const supportedNamespaces = {
    //           eip155: {
    //             chains: netIds.map((netId) => `eip155:${netId}`),
    //             methods: ['eth_sendTransaction', 'personal_sign'],
    //             events: ['accountsChanged', 'chainChanged'],
    //             accounts: netIds.map((netId) => hexAddresses.map((hexAddress) => `eip155:${netId}:${hexAddress}`)).flat(),
    //           },
    //         };
    //         this.web3wallet.on('session_proposal', (proposal) => this._onSessionProposal({ ...proposal, supportedNamespaces }));
    //       });
    //   })
    //   .catch((err) => {
    //     console.log('init error', err);
    //   });
  }

  private getAPP = async (proposer: Web3WalletTypes.SessionProposal['params']['proposer']) => {
    let app = await methods.isAppExist(proposer.publicKey);
    if (!app) {
      app = await methods.createApp({
        identity: proposer.publicKey,
        name: proposer.metadata.name,
        ...(proposer.metadata.icons?.[0] ? { icon: proposer.metadata.icons[0] } : null),
        ...(proposer.metadata.url ? { origin: proposer.metadata.url } : null),
      });
    }

    return app;
  };

  private formatRPCError = (
    id: number,
    error:
      | ReturnType<typeof getSdkError>
      | {
          message: string;
          code: number;
        },
  ) => {
    return {
      id,
      jsonrpc: '2.0',
      error: error,
    };
  };

  private initListeners = async () => {
    const client = await this.web3wallet;
    console.log('get client then init listeners');
    client.on('session_proposal', this.onSessionProposal);
    client.on('session_request', this.onSessionRequest);
    client.on('auth_request', (e) => console.log('auth_request'));
    client.on('session_delete', () => {
      console.log('session_delete');
      // TOOD: Notify APP connection is deleted
    });
  };

  private onSessionProposal = async (proposal: Web3WalletTypes.SessionProposal) => {
    const proposer = proposal.params.proposer;

    if (!proposer.publicKey) return;

    const app = await this.getAPP(proposer);

    await methods.createRequest({
      app,
      type: RequestType.WalletConnectProposal,
      resolve: async () => {
        const address = await firstValueFrom(currentAddressObservable);
        if (!address) {
          console.log('no address');
          return;
        }
        const network = await address?.network;
        // TODO let user to choose network and address
        const client = await this.web3wallet;
        const { id, proposer, requiredNamespaces } = proposal.params;
        const supportedNamespaces = {
          eip155: {
            chains: [`eip155:${network.netId}`],
            methods: requiredNamespaces?.eip155?.methods || ['eth_sendTransaction', 'personal_sign'],
            events: requiredNamespaces?.eip155?.events || ['accountsChanged', 'chainChanged'],
            accounts: [`eip155:${network.netId}:${address.hex}`],
          },
        };
        // ------- namespaces builder util ------------ //
        const approvedNamespaces = buildApprovedNamespaces({
          proposal: proposal.params,
          supportedNamespaces,
        });
        // ------- end namespaces builder util ------------ //
        await client.approveSession({
          id: proposal.id,
          namespaces: approvedNamespaces,
        });
      },
      reject: async () => {
        await this.rejectProposal(proposal, 'USER_REJECTED');
      },
    });
  };

  public rejectProposal = async (proposal: Web3WalletTypes.SessionProposal, reason: Parameters<typeof getSdkError>[0]) => {
    const client = await this.web3wallet;
    const { id, proposer } = proposal.params;
    await client.rejectSession({ id, reason: getSdkError(reason) });
  };

  public onSessionRequest = async (request: Web3WalletTypes.SessionRequest) => {
    const client = await this.web3wallet;
    console.log('wallet connect session request', request);

    const { id, topic } = request;
    const { method, params } = request.params.request;

    // todo  check chain id is current id

    if (method === WalletConnectRPCMethod.Sign) {
      await client.respondSessionRequest({
        topic,
        response: this.formatRPCError(id, getSdkError('UNSUPPORTED_METHODS')),
      });
      return;
    }

    if (this.supportedRPCMethods.includes(method as WalletConnectRPCMethod)) {
      if (this.supportedSigningMethods.includes(method as WalletConnectRPCMethod)) {
        // if is sign message request check address and message
        const [address, message] = params.sort((a: any) => (isAddress(a) ? -1 : 1));
        if (!address || !message) {
          await client.respondSessionRequest({
            topic,
            response: this.formatRPCError(id, { message: 'Invalid params', code: 1 }),
          });
          return;
        }
      }

      // get current session
      const session = Object.values(client.getActiveSessions()).find((s) => s.topic === topic);

      if (!session) {
        console.log('wallet session request get no session');
        await client.respondSessionRequest({
          topic,
          response: this.formatRPCError(id, { message: 'No session', code: 1 }),
        });
        return;
      }
      const app = await this.getAPP(session.peer);

      await methods.createRequest({
        app,
        type: RequestType.WalletRequest,
        resolve: async (result: string) => {
          await client.respondSessionRequest({
            topic,
            response: {
              id,
              jsonrpc: '2.0',
              result,
            },
          });
        },
        reject: async (...args) => {
          await client.respondSessionRequest({
            topic,
            response: this.formatRPCError(id, getSdkError('USER_REJECTED')),
          });
        },
        payload: request.params,
      });
    } else {
      console.log('wallet session request get unsupported method', method);

      await client.respondSessionRequest({
        topic,
        response: this.formatRPCError(id, getSdkError('UNSUPPORTED_METHODS')),
      });
    }
  };

  public pair = async (uri: string) => {
    const client = await this.web3wallet;
    return client.core.pairing.pair({ uri });
  };
}

export default WalletConnectPluginClass;
