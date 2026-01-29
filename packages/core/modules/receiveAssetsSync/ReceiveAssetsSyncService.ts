import type { ChainRegistry } from '@core/chains';
import type { Database } from '@core/database';
import type { Address } from '@core/database/models/Address';
import type { Asset } from '@core/database/models/Asset';
import { AssetSource, AssetType } from '@core/database/models/Asset';
import type { AssetRule } from '@core/database/models/AssetRule';
import { type Network, NetworkType } from '@core/database/models/Network';
import TableName from '@core/database/TableName';
import { CHAIN_PROVIDER_NOT_FOUND, CoreError, RECEIVE_ASSETS_SYNC_FAILED } from '@core/errors';
import type { AccountService } from '@core/services/account';
import type { NetworkService } from '@core/services/network';
import type { IChainProvider } from '@core/types';
import { convertToChecksum } from '@core/utils/account';
import { Q } from '@nozbe/watermelondb';
import type { CoreEventMap, EventBus, Subscription } from '../eventBus';
import { type ESpaceConfig, type FetchFunction, fetchESpaceOfficialTokens } from './fetchers/eSpaceTokenList';

type Reason = 'start' | 'network_changed' | 'manual';

type ReceiveAssetsSyncServiceOptions = {
  db: Database;
  chainRegistry: ChainRegistry;
  accountService: AccountService;
  networkService: NetworkService;
  eventBus: EventBus<CoreEventMap>;
  now: () => number;
  logger: { warn: (message: string, meta?: Record<string, unknown>) => void };
  fetchFn?: FetchFunction;
};

const E_SPACE_CONFIG_BY_CHAIN_ID: Record<string, ESpaceConfig> = {
  '0x406': {
    tokenListContract: '0xf1a8b97ef61bf8fe3c54c94a16c57c0f7afc2277',
    scanOpenApiBaseUrl: 'https://evmapi.confluxscan.org',
  },
  '0x47': {
    tokenListContract: '0xcd54f022b0355e00db610f6b3411c76b5c61320f',
    scanOpenApiBaseUrl: 'https://evmapi-testnet.confluxscan.org',
  },
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const toErrorSnapshot = (error: unknown, fallback: { code: string; message: string }) => {
  if (isObject(error)) {
    const code = typeof error.code === 'string' ? error.code : fallback.code;
    const message = typeof error.message === 'string' ? error.message : fallback.message;
    const context = isObject(error.context) ? (error.context as Record<string, unknown>) : undefined;
    return context ? { code, message, context } : { code, message };
  }
  return { code: fallback.code, message: fallback.message };
};

export class ReceiveAssetsSyncService {
  private readonly db: Database;
  private readonly chainRegistry: ChainRegistry;
  private readonly accountService: AccountService;
  private readonly networkService: NetworkService;
  private readonly eventBus: EventBus<CoreEventMap>;
  private readonly now: () => number;
  private readonly logger: ReceiveAssetsSyncServiceOptions['logger'];
  private readonly fetchFn?: FetchFunction;

  private started = false;
  private runGeneration = 0;
  private subs: Subscription[] = [];

  private runSeq = 0;
  private inFlight: Promise<void> | null = null;
  private inFlightGen: number | null = null;
  private pending: { reason: Reason; expectedNetworkId: string | null } | null = null;

  constructor(opts: ReceiveAssetsSyncServiceOptions) {
    this.db = opts.db;
    this.chainRegistry = opts.chainRegistry;
    this.accountService = opts.accountService;
    this.networkService = opts.networkService;
    this.eventBus = opts.eventBus;
    this.now = opts.now;
    this.logger = opts.logger;
    this.fetchFn = opts.fetchFn;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.runGeneration += 1;

    const gen = this.runGeneration;

    this.subs.push(
      this.eventBus.on('network/current-changed', (payload) => {
        this.pending = { reason: 'network_changed', expectedNetworkId: payload.network.id };
        void this.refresh(gen);
      }),
    );

    this.pending = { reason: 'start', expectedNetworkId: null };
    void this.refresh(gen);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.runGeneration += 1;

    for (const s of this.subs) s.unsubscribe();
    this.subs = [];

    this.pending = null;

    this.inFlight = null;
    this.inFlightGen = null;
  }
  private makeRunId(): string {
    this.runSeq += 1;
    return `receive_assets_sync_${this.now().toString(36)}_${this.runSeq.toString(36)}`;
  }

  private async refresh(gen: number): Promise<void> {
    if (!this.started) return;
    if (gen !== this.runGeneration) return;

    if (this.inFlight && this.inFlightGen === gen) {
      return this.inFlight;
    }

    const drain = this.drainPending(gen);
    this.inFlight = drain;
    this.inFlightGen = gen;

    try {
      await drain;
    } finally {
      if (this.inFlight === drain) {
        this.inFlight = null;
        this.inFlightGen = null;
      }
    }
  }

  private async drainPending(gen: number): Promise<void> {
    while (this.started && gen === this.runGeneration) {
      const next = this.pending;
      if (!next) return;

      this.pending = null;

      await this.runOnce({
        reason: next.reason,
        runId: this.makeRunId(),
        expectedNetworkId: next.expectedNetworkId,
        gen,
      });
    }
  }
  private async runOnce(params: { reason: Reason; runId: string; expectedNetworkId: string | null; gen: number }): Promise<void> {
    const { reason, runId } = params;

    let currentNetwork: Awaited<ReturnType<NetworkService['getCurrentNetwork']>>;
    try {
      currentNetwork = await this.networkService.getCurrentNetwork();
    } catch (error) {
      if (!this.started || params.gen !== this.runGeneration) return;
      this.logger.warn('ReceiveAssetsSync:getCurrentNetwork-failed', { reason, runId, error });
      return;
    }

    if (!this.started || params.gen !== this.runGeneration) return;
    if (params.expectedNetworkId && currentNetwork.id !== params.expectedNetworkId) return;

    const config = this.getESpaceConfigOrNull({
      chainId: currentNetwork.chainId,
      networkType: currentNetwork.networkType,
    });
    if (!config) {
      return;
    }

    if (!this.started || params.gen !== this.runGeneration) return;
    this.eventBus.emit('receive-assets-sync/started', {
      networkId: currentNetwork.id,
      reason,
      runId,
      timestampMs: this.now(),
    });

    try {
      const provider = this.getProviderOrThrow({
        chainId: currentNetwork.chainId,
        networkType: currentNetwork.networkType,
        networkId: currentNetwork.id,
      });

      const address = await this.getCurrentAddressOrNull({ expectedNetworkId: currentNetwork.id });
      if (!this.started || params.gen !== this.runGeneration) return;

      if (!address) {
        this.eventBus.emit('receive-assets-sync/succeeded', {
          networkId: currentNetwork.id,
          reason,
          runId,
          timestampMs: this.now(),
          createdCount: 0,
          updatedCount: 0,
        });
        return;
      }

      const networkModel = await this.db.get<Network>(TableName.Network).find(currentNetwork.id);
      const assetRule = await address.assetRule.fetch();

      const tokens = await fetchESpaceOfficialTokens({
        provider,
        config,
        fetchFn: this.fetchFn,
      });

      if (!this.started || params.gen !== this.runGeneration) return;

      // If network switched while in-flight, skip side effects for stale run.
      const latestNetwork = await this.networkService.getCurrentNetwork();
      if (latestNetwork.id !== currentNetwork.id) return;

      const { createdCount, updatedCount } = await this.upsertAssets({
        network: networkModel,
        assetRule,
        tokens,
      });

      if (!this.started || params.gen !== this.runGeneration) return;

      this.eventBus.emit('receive-assets-sync/succeeded', {
        networkId: currentNetwork.id,
        reason,
        runId,
        timestampMs: this.now(),
        createdCount,
        updatedCount,
      });
    } catch (error) {
      if (!this.started || params.gen !== this.runGeneration) return;

      const snapshot = toErrorSnapshot(error, { code: RECEIVE_ASSETS_SYNC_FAILED, message: 'Receive assets sync failed.' });

      this.logger.warn('ReceiveAssetsSync:failed', { networkId: currentNetwork.id, reason, runId, error: snapshot });

      this.eventBus.emit('receive-assets-sync/failed', {
        networkId: currentNetwork.id,
        reason,
        runId,
        timestampMs: this.now(),
        error: snapshot,
      });
    }
  }

  private getProviderOrThrow(params: { chainId: string; networkType: NetworkType; networkId: string }): IChainProvider {
    const provider = this.chainRegistry.get(params.chainId, params.networkType);
    if (!provider) {
      throw new CoreError({
        code: CHAIN_PROVIDER_NOT_FOUND,
        message: 'Chain provider not found.',
        context: { chainId: params.chainId, networkType: params.networkType, networkId: params.networkId },
      });
    }
    return provider;
  }

  private getESpaceConfigOrNull(network: { chainId: string; networkType: NetworkType }): ESpaceConfig | null {
    if (network.networkType !== NetworkType.Ethereum) return null;
    const key = network.chainId.toLowerCase();
    return E_SPACE_CONFIG_BY_CHAIN_ID[key] ?? null;
  }

  private async getCurrentAddressOrNull(params: { expectedNetworkId: string }): Promise<Address | null> {
    const account = await this.accountService.getCurrentAccount();
    if (!account?.currentAddressId) return null;

    let address: Address;
    try {
      address = await this.db.get<Address>(TableName.Address).find(account.currentAddressId);
    } catch {
      return null;
    }

    const network = await address.network.fetch();
    if (network.id !== params.expectedNetworkId) {
      return null;
    }

    return address;
  }
  private async upsertAssets(params: {
    network: Network;
    assetRule: AssetRule;
    tokens: Array<{ contractAddress: string; name: string; symbol: string; decimals: number; icon?: string }>;
  }): Promise<{ createdCount: number; updatedCount: number }> {
    const { network, assetRule, tokens } = params;
    if (tokens.length === 0) {
      return { createdCount: 0, updatedCount: 0 };
    }

    const existing = await this.db
      .get<Asset>(TableName.Asset)
      .query(Q.where('network_id', network.id), Q.where('asset_rule_id', assetRule.id), Q.where('type', AssetType.ERC20))
      .fetch();

    const byAddress = new Map<string, Asset>();
    for (const asset of existing) {
      if (!asset.contractAddress) continue;
      byAddress.set(asset.contractAddress.toLowerCase(), asset);
    }

    let createdCount = 0;
    let updatedCount = 0;

    await this.db.write(async () => {
      const ops: Asset[] = [];

      for (const token of tokens) {
        let contract: string;
        try {
          contract = convertToChecksum(token.contractAddress.trim());
        } catch {
          continue;
        }

        const found = byAddress.get(contract.toLowerCase());
        if (!found) {
          ops.push(
            this.db.get<Asset>(TableName.Asset).prepareCreate((record) => {
              record.network.set(network);
              record.assetRule.set(assetRule);
              record.type = AssetType.ERC20;
              record.contractAddress = contract;
              record.name = token.name || null;
              record.symbol = token.symbol || null;
              record.decimals = Number.isFinite(token.decimals) ? token.decimals : 18;
              record.icon = token.icon ?? null;
              record.source = AssetSource.Official;
              record.priceInUSDT = null;
            }),
          );
          createdCount += 1;
          continue;
        }
        const nextName = token.name || null;
        const nextSymbol = token.symbol || null;
        const nextDecimals = Number.isFinite(token.decimals) ? token.decimals : found.decimals;
        const nextIcon = token.icon ?? found.icon;

        const nextSource = found.source ?? AssetSource.Official;

        const changed =
          found.name !== nextName || found.symbol !== nextSymbol || found.decimals !== nextDecimals || found.icon !== nextIcon || found.source !== nextSource;

        if (!changed) {
          continue;
        }

        ops.push(
          found.prepareUpdate((record) => {
            record.name = nextName;
            record.symbol = nextSymbol;
            record.decimals = nextDecimals ?? record.decimals;
            record.icon = nextIcon;

            // Strategy #2: keep source unchanged; only fill when missing.
            if (!record.source) {
              record.source = AssetSource.Official;
            }
          }),
        );
        updatedCount += 1;
      }

      if (ops.length > 0) {
        await this.db.batch(...ops);
      }
    });

    return { createdCount, updatedCount };
  }
}
