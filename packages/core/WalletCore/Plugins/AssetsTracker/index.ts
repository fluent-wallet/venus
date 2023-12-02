import { type Plugin } from '../../Plugins';
import { AssetType } from '@core/database/models/Asset';

interface Tracker {
  fetchAssetBalance: (params: { accountAddress: string; assetAddress: string; assetType: AssetType }) => Promise<string>;
  fetchAssetInfo: (params: { accountAddress: string; assetAddress: string; assetType: AssetType }) => Promise<any>;
  fetchAssetsBalance: (params: { accountAddress: string; assets: Array<{ assetAddress: string; assetType: AssetType }> }) => Promise<Array<string>>;
  fetchAssetsInfo: (params: { accountAddress: string; assetAddress: string; assetType: AssetType }) => Promise<Array<any>>;
}

class AssetsTrackerPlugin implements Plugin {
  public name = 'AssetsTracker';
}

export default AssetsTrackerPlugin;
