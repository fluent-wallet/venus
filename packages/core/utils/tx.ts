import { Asset, AssetType } from '@core/database/models/Asset';
import { FAILED_TX_STATUSES, PENDING_TX_STATUSES, TxStatus } from '@core/database/models/Tx/type';
import { TxPayload } from '@core/database/models/TxPayload';
import { iface1155, iface721, iface777 } from '@core/contracts';

export const formatStatus = (status: TxStatus): 'failed' | 'pending' | 'confirmed' => {
  if (PENDING_TX_STATUSES.includes(status)) {
    return 'pending';
  }
  if (FAILED_TX_STATUSES.includes(status)) {
    return 'failed';
  }
  return 'confirmed';
};

export const formatTxData = (payload: TxPayload | null, asset: Asset | null) => {
  let value = payload?.value;
  let to = payload?.to;
  let from = payload?.from;
  let tokenId = '';
  const decimals = asset?.decimals ?? 18;
  switch (asset?.type) {
    case AssetType.ERC20: {
      if (payload?.data) {
        const params = iface777.decodeFunctionData('transfer', payload.data);
        to = params[0];
        value = params[1].toString();
      }
      break;
    }
    case AssetType.ERC721: {
      if (payload?.data) {
        const params = iface721.decodeFunctionData('transferFrom', payload.data);
        from = params[0];
        to = params[1];
        tokenId = params[2].toString();
        value = '1';
      }
      break;
    }
    case AssetType.ERC1155: {
      if (payload?.data) {
        const params = iface1155.decodeFunctionData('safeTransferFrom', payload.data);
        from = params[0];
        to = params[1];
        tokenId = params[2].toString();
        value = params[3].toString();
      }
      break;
    }
  }
  return {
    to,
    from,
    value,
    tokenId,
    decimals,
    nonce: payload?.nonce,
  };
};
