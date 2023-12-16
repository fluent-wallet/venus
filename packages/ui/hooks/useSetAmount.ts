import { atom } from 'jotai';
import { AccountTokenListItem, nativeTokenAtom } from './useTokenList';
import { getAssetsAtomKey, getAssetsHash } from '@core/WalletCore/Plugins/ReactInject/data/useAssets';
import { AssetType } from '@core/database/models/Asset';
import { AssetInfo } from '@core/WalletCore/Plugins/AssetsTracker/types';
import { getCurrentNetwork } from '@core/WalletCore/Plugins/ReactInject/data/useCurrentNetwork';
import { getCurrentAddress } from '@core/WalletCore/Plugins/ReactInject/data/useCurrentAddress';

interface TokenQRInfo extends AssetInfo {
  parameters?: {
    value?: bigint;
    uint256?: bigint;
    gas?: string;
    gasLimit?: string;
    gasPrice?: string;
  };
}

const _TokenQRInfoAtom = atom<TokenQRInfo | null>(null);

const setTokenQRInfoAtom = atom(
  (get) => {
    const setAmount = get(_TokenQRInfoAtom);
    if (setAmount === null) {
      const network = getCurrentNetwork();
      const address = getCurrentAddress();
      const hashKey = getAssetsAtomKey({ network, address });
      const assetsHash = getAssetsHash(hashKey);
      if (assetsHash && assetsHash[AssetType.Native]) return assetsHash[AssetType.Native] as TokenQRInfo;
    }
    return setAmount as TokenQRInfo;
  },
  (get, set, update: TokenQRInfo | null) => {
    set(_TokenQRInfoAtom, update);
  }
);

export default setTokenQRInfoAtom;
