import { iface721, iface777, iface1155 } from '@core/contracts';
import { type Asset, AssetType } from '@core/database/models/Asset';
import type { Tx } from '@core/database/models/Tx';
import { ExecutedStatus, FAILED_TX_STATUSES, PENDING_TX_STATUSES } from '@core/database/models/Tx/type';
import type { TxPayload } from '@core/database/models/TxPayload';
import { type FunctionNameApprove, parseTxData } from '@utils/parseTxData';

export const formatStatus = (tx: Tx): 'failed' | 'pending' | 'confirmed' => {
  const { status, executedStatus } = tx;
  if (PENDING_TX_STATUSES.includes(status)) {
    return 'pending';
  }
  if (FAILED_TX_STATUSES.includes(status) || executedStatus === ExecutedStatus.FAILED) {
    return 'failed';
  }
  return 'confirmed';
};

export const formatTxData = (tx: Tx | null, payload: TxPayload | null, asset: Asset | null) => {
  let value = payload?.value;
  let to = payload?.to;
  let from = payload?.from;
  let tokenId = '';
  let isTransfer = false;
  try {
    switch (asset?.type) {
      case AssetType.ERC20: {
        if (tx?.method === 'transfer' && payload?.data) {
          const params = iface777.decodeFunctionData('transfer', payload.data);
          to = params[0];
          value = params[1].toString();
          isTransfer = true;
        }
        break;
      }
      case AssetType.ERC721: {
        if (tx?.method === 'transferFrom' && payload?.data) {
          const params = iface721.decodeFunctionData('transferFrom', payload.data);
          from = params[0];
          to = params[1];
          tokenId = params[2].toString();
          value = '1';
          isTransfer = true;
        }
        break;
      }
      case AssetType.ERC1155: {
        if (tx?.method === 'safeTransferFrom' && payload?.data) {
          const params = iface1155.decodeFunctionData('safeTransferFrom', payload.data);
          from = params[0];
          to = params[1];
          tokenId = params[2].toString();
          value = params[3].toString();
          isTransfer = true;
        }
        break;
      }
      case AssetType.Native: {
        if (tx?.method === 'transfer') {
          isTransfer = true;
        }
        break;
      }
    }
    if (!isTransfer && asset && payload && tx?.method === 'approve') {
      const { value: approveValue } = parseTxData({ data: payload.data, to: payload.to }) as FunctionNameApprove;
      if (approveValue) {
        value = approveValue.toString();
      }
    }
  } catch (error) {
    console.log('parse tx data error', error);
  }
  return {
    to,
    from,
    value,
    tokenId,
    nonce: payload?.nonce,
    isTransfer,
  };
};
