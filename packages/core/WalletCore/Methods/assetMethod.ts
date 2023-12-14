import { injectable } from 'inversify';
import { type Asset } from '../../database/models/Asset';
import { createAsset as _createAsset, type AssetParams } from '../../database/models/Asset/query';
export { type AssetParams } from '../../database/models/Asset/query';

@injectable()
export class AssetMethod {
  createAsset(params: AssetParams, prepareCreate: true): Asset;
  createAsset(params: AssetParams): Promise<Asset>;
  createAsset(params: AssetParams, prepareCreate?: true) {
    return _createAsset(params, prepareCreate as true) as Asset | Promise<Asset>;
  }

  async updateAsset({ asset, priceInUSDT, icon }: { asset: Asset; priceInUSDT?: string; icon?: string }) {
    return asset.updateSelft({ priceInUSDT, icon });
  }

  prepareUpdateAsset({ asset, priceInUSDT, icon }: { asset: Asset; priceInUSDT?: string; icon?: string }) {
    return asset.prepareUpdateSelft({ priceInUSDT, icon });
  }
}
