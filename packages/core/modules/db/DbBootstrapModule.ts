import type { Database } from '@core/database';
import type { Asset } from '@core/database/models/Asset';
import { AssetSource, AssetType } from '@core/database/models/Asset';
import type { AssetRule } from '@core/database/models/AssetRule';
import type { HdPath } from '@core/database/models/HdPath';
import type { Network } from '@core/database/models/Network';
import TableName from '@core/database/TableName';
import { CORE_IDENTIFIERS } from '@core/di';
import { CoreError, DB_BOOTSTRAP_INVALID_CONFIG, DB_BOOTSTRAP_SEED_FAILED } from '@core/errors';
import type { RuntimeModule } from '@core/runtime/types';
import { DEFAULT_CFX_HDPATH, DEFAULT_ETH_HDPATH, Networks } from '@core/utils/consts';
import { DB_BOOTSTRAP_MODULE_ID, DB_MODULE_ID } from '../ids';

const HD_PATH_DEFS = [
  { name: 'cfx-default', value: DEFAULT_CFX_HDPATH },
  { name: 'eth-default', value: DEFAULT_ETH_HDPATH },
] as const;

export const DbBootstrapModule: RuntimeModule = {
  id: DB_BOOTSTRAP_MODULE_ID,
  dependencies: [DB_MODULE_ID],

  start: async ({ container, logger }) => {
    const db = container.get<Database>(CORE_IDENTIFIERS.DB);

    const networkCount = await db.get<Network>(TableName.Network).query().fetchCount();
    if (networkCount !== 0) return;

    const entries = Object.entries(Networks);
    if (entries.length === 0) {
      throw new CoreError({
        code: DB_BOOTSTRAP_INVALID_CONFIG,
        message: 'No builtin networks found in Networks const.',
      });
    }

    const selectedKey = entries.find(([, def]) => def.selected)?.[0] ?? entries[0][0];

    try {
      await db.write(async () => {
        const existingHdPaths = await db.get<HdPath>(TableName.HdPath).query().fetch();

        const hdPathsByIndex: HdPath[] = [];
        const operations = [];

        for (let index = 0; index < HD_PATH_DEFS.length; index += 1) {
          const def = HD_PATH_DEFS[index];
          const reuse = existingHdPaths.find((p) => p.value === def.value);

          if (reuse) {
            hdPathsByIndex[index] = reuse;
            continue;
          }

          const created = db.get<HdPath>(TableName.HdPath).prepareCreate((record) => {
            record.name = def.name;
            record.value = def.value;
          });

          hdPathsByIndex[index] = created;
          operations.push(created);
        }

        for (const [key, def] of entries) {
          if (typeof def.hdPathIndex !== 'number') {
            throw new CoreError({
              code: DB_BOOTSTRAP_INVALID_CONFIG,
              message: 'Missing hdPathIndex for builtin network.',
              context: { key },
            });
          }

          const hdPath = hdPathsByIndex[def.hdPathIndex];
          if (!hdPath) {
            throw new CoreError({
              code: DB_BOOTSTRAP_INVALID_CONFIG,
              message: 'Missing default HdPath record for builtin network.',
              context: { key, hdPathIndex: def.hdPathIndex },
            });
          }

          const network = db.get<Network>(TableName.Network).prepareCreate((record) => {
            record.name = def.name;
            record.endpoint = def.endpoint;
            record.netId = def.netId;
            record.chainId = def.chainId;
            record.gasBuffer = def.gasBuffer ?? 1;
            record.networkType = def.networkType;
            record.chainType = def.chainType;
            record.icon = def.icon ?? null;
            record.scanUrl = def.scanUrl ?? null;
            record.selected = key === selectedKey;
            record.builtin = def.builtin ?? true;
            record.endpointsList = [{ endpoint: def.endpoint, type: 'inner' }];
            record.hdPath.set(hdPath);
          });

          const assetRule = db.get<AssetRule>(TableName.AssetRule).prepareCreate((record) => {
            record.name = 'default-rule';
            record.index = 0;
            record.network.set(network);
          });

          const fallbackLabel = network.name.split(' ')?.[0] || 'Ether';

          const nativeAsset = db.get<Asset>(TableName.Asset).prepareCreate((record) => {
            record.network.set(network);
            record.assetRule.set(assetRule);
            record.type = AssetType.Native;
            record.contractAddress = '';
            record.name = def.nativeAsset?.name ?? fallbackLabel;
            record.symbol = def.nativeAsset?.symbol ?? fallbackLabel;
            record.decimals = def.nativeAsset?.decimals ?? 18;
            record.icon = def.nativeAsset?.icon ?? null;
            record.source = AssetSource.Official;
            record.priceInUSDT = null;
          });

          operations.push(network, assetRule, nativeAsset);
        }

        await db.batch(...operations);
      });
    } catch (error) {
      if (error instanceof CoreError) {
        throw error;
      }

      throw new CoreError({
        code: DB_BOOTSTRAP_SEED_FAILED,
        message: 'Failed to seed default database records.',
        cause: error,
      });
    }

    logger.info('DbBootstrapModule:seeded-defaults', { networks: entries.length, selectedKey });
  },
};
