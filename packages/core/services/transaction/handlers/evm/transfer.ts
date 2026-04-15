import { buildTransactionPayload } from '@core/chains/utils/transactionBuilder';
import { iface721, iface1155 } from '@core/contracts';
import { AssetType, type Hex } from '@core/types';
import { NetworkType } from '@core/utils/consts';
import * as OxValue from 'ox/Value';
import type { PreparedTransferAsset, ReviewError, ReviewTransferResult, TransactionReviewOverride, TransferIntent } from '../../stagedTypes';
import type { TransactionHandlers } from '../types';
import { buildEvmUnsignedTransaction, buildPresetOptions, getFeeUnitPrice, pickFee, toDisplayAmount } from './shared';
import type { ComputedTransferPlan, EvmHandlerDeps, EvmTransferAssetType, TransferPlanResult } from './types';

async function readErc721Owned(params: { chainProvider: EvmHandlerDeps['chainProvider']; contractAddress: string; tokenId: string; owner: string }) {
  const { chainProvider, contractAddress, tokenId, owner } = params;

  try {
    const raw = await chainProvider.call({
      to: contractAddress,
      data: iface721.encodeFunctionData('ownerOf', [BigInt(tokenId)]) as Hex,
    });
    const [resolvedOwner] = iface721.decodeFunctionResult('ownerOf', raw);
    return typeof resolvedOwner === 'string' && resolvedOwner.toLowerCase() === owner.toLowerCase();
  } catch {
    return false;
  }
}

async function readErc1155Balance(params: { chainProvider: EvmHandlerDeps['chainProvider']; contractAddress: string; tokenId: string; owner: string }) {
  const { chainProvider, contractAddress, tokenId, owner } = params;

  try {
    const raw = await chainProvider.call({
      to: contractAddress,
      data: iface1155.encodeFunctionData('balanceOf', [owner, BigInt(tokenId)]) as Hex,
    });
    const [balance] = iface1155.decodeFunctionResult('balanceOf', raw);
    return BigInt(String(balance));
  } catch {
    return 0n;
  }
}

function getTransferAssetType(standard: TransferIntent['asset']['standard']): EvmTransferAssetType | null {
  if (standard === 'native') return AssetType.Native;
  if (standard === 'erc20') return AssetType.ERC20;
  if (standard === 'erc721') return AssetType.ERC721;
  if (standard === 'erc1155') return AssetType.ERC1155;
  return null;
}

function getTransferAssetDecimals(assetType: EvmTransferAssetType, asset: TransferIntent['asset']): number | null {
  if (assetType === AssetType.Native) return 18;
  if (assetType === AssetType.ERC20) return typeof asset.decimals === 'number' ? asset.decimals : null;
  return 0;
}

async function readTransferAssetBalance(params: {
  chainProvider: EvmHandlerDeps['chainProvider'];
  from: string;
  assetType: EvmTransferAssetType;
  asset: TransferIntent['asset'];
  nativeBalance: bigint;
}) {
  const { chainProvider, from, assetType, asset, nativeBalance } = params;

  if (assetType === AssetType.Native) return nativeBalance;

  if (assetType === AssetType.ERC20) {
    const balances = await chainProvider.readFungibleAssetBalances(from, [{ assetType: AssetType.ERC20, contractAddress: asset.contractAddress! }]);
    return BigInt(balances[0] ?? '0x0');
  }

  if (assetType === AssetType.ERC721) {
    return (await readErc721Owned({
      chainProvider,
      contractAddress: asset.contractAddress!,
      tokenId: asset.tokenId!,
      owner: from,
    }))
      ? 1n
      : 0n;
  }

  return readErc1155Balance({
    chainProvider,
    contractAddress: asset.contractAddress!,
    tokenId: asset.tokenId!,
    owner: from,
  });
}

function formatTransferAmount(assetType: EvmTransferAssetType, balance: bigint, decimals: number) {
  if (assetType === AssetType.Native || assetType === AssetType.ERC20) {
    return toDisplayAmount(balance, decimals);
  }

  return balance.toString();
}

async function computeTransferPlan(
  params: EvmHandlerDeps & { from: string; intent: TransferIntent; override?: TransactionReviewOverride },
): Promise<TransferPlanResult> {
  const { ctx, chainProvider, from, intent, override } = params;
  const asset = intent.asset;

  if (!chainProvider.validateAddress(intent.recipient)) {
    return {
      ok: false,
      maxAmount: null,
      error: { code: 'invalid_recipient', message: 'The recipient address is invalid.' },
    };
  }

  const assetType = getTransferAssetType(asset.standard);
  if (!assetType) {
    return {
      ok: false,
      maxAmount: null,
      error: { code: 'unsupported', message: 'Unsupported EVM asset standard.' },
    };
  }

  if (assetType !== AssetType.Native && !asset.contractAddress) {
    return {
      ok: false,
      maxAmount: null,
      error: { code: 'unsupported', message: 'Missing contract address.' },
    };
  }

  if ((assetType === AssetType.ERC721 || assetType === AssetType.ERC1155) && !asset.tokenId) {
    return {
      ok: false,
      maxAmount: null,
      error: { code: 'unsupported', message: 'Missing token id.' },
    };
  }

  const decimals = getTransferAssetDecimals(assetType, asset);
  if (decimals == null) {
    return {
      ok: false,
      maxAmount: null,
      error: { code: 'unsupported', message: 'Missing decimals for ERC20 asset.' },
    };
  }

  const nonce = override?.nonce ?? (await chainProvider.getNonce(from));
  const nativeBalances = await chainProvider.readFungibleAssetBalances(from, [{ assetType: AssetType.Native }]);
  const nativeBalance = BigInt(nativeBalances[0] ?? '0x0');
  const assetBalance = await readTransferAssetBalance({
    chainProvider,
    from,
    assetType,
    asset,
    nativeBalance,
  });

  const assetMaxAmount = formatTransferAmount(assetType, assetBalance, decimals);

  let requestedAmountBaseUnits: bigint | null = null;
  if (intent.amount.kind === 'exact') {
    try {
      requestedAmountBaseUnits = OxValue.from(intent.amount.amount, decimals);
    } catch {
      return {
        ok: false,
        maxAmount: null,
        error: { code: 'invalid_amount', message: 'The transfer amount is invalid.' },
      };
    }

    if (requestedAmountBaseUnits <= 0n) {
      return {
        ok: false,
        maxAmount: null,
        error: { code: 'invalid_amount', message: 'The transfer amount must be greater than zero.' },
      };
    }

    if (assetType === AssetType.ERC721 && intent.amount.amount !== '1') {
      return {
        ok: false,
        maxAmount: null,
        error: { code: 'invalid_amount', message: 'ERC721 transfer amount must be 1.' },
      };
    }

    if (assetType !== AssetType.Native && assetBalance < requestedAmountBaseUnits) {
      return {
        ok: false,
        maxAmount: assetMaxAmount,
        error: { code: 'insufficient_asset_balance', message: 'Insufficient asset balance.' },
      };
    }
  } else if (assetType !== AssetType.Native && assetBalance <= 0n) {
    return {
      ok: false,
      maxAmount: assetMaxAmount,
      error: { code: 'insufficient_asset_balance', message: 'Insufficient asset balance.' },
    };
  }

  const amountForEstimate = intent.amount.kind === 'exact' ? intent.amount.amount : assetType === AssetType.Native ? '0' : assetMaxAmount;
  const estimateRequest = buildTransactionPayload({
    from,
    to: intent.recipient,
    amount: amountForEstimate,
    data: assetType === AssetType.Native ? intent.data : undefined,
    assetType,
    assetDecimals: decimals,
    chainId: ctx.network.chainId,
    contractAddress: asset.contractAddress,
    nftTokenId: asset.tokenId,
  });

  const estimate = await chainProvider.estimateFee({
    chainType: NetworkType.Ethereum,
    payload: {
      ...estimateRequest,
      nonce,
    },
  });

  const gasLimit = override?.gasLimit ?? estimate.gasLimit;
  const presetOptions = buildPresetOptions({
    gasLimit,
    gasPrice: estimate.gasPrice,
    maxFeePerGas: estimate.maxFeePerGas,
    maxPriorityFeePerGas: estimate.maxPriorityFeePerGas,
  });
  const { selection, fields: feeFields } = pickFee(presetOptions, override);
  const gasCost = getFeeUnitPrice(feeFields) * BigInt(gasLimit);

  const maxAmountBaseUnits = assetType === AssetType.Native ? (nativeBalance > gasCost ? nativeBalance - gasCost : 0n) : assetBalance;
  const maxAmount = formatTransferAmount(assetType, maxAmountBaseUnits, decimals);
  const amount = intent.amount.kind === 'exact' ? intent.amount.amount : maxAmount;
  const amountBaseUnits = intent.amount.kind === 'exact' ? requestedAmountBaseUnits! : maxAmountBaseUnits;

  let error: ReviewError | null = null;
  if (assetType === AssetType.Native) {
    if (amountBaseUnits <= 0n) {
      error = { code: 'insufficient_native_for_fee', message: 'Insufficient native balance for gas.' };
    } else if (nativeBalance < amountBaseUnits + gasCost) {
      error = { code: 'insufficient_native_for_fee', message: 'Insufficient native balance.' };
    }
  } else if (nativeBalance < gasCost) {
    error = { code: 'insufficient_native_for_fee', message: 'Insufficient native balance for gas.' };
  }

  const executionRequest = buildTransactionPayload({
    from,
    to: intent.recipient,
    amount,
    data: assetType === AssetType.Native ? intent.data : undefined,
    assetType,
    assetDecimals: decimals,
    chainId: ctx.network.chainId,
    contractAddress: asset.contractAddress,
    nftTokenId: asset.tokenId,
  });

  const plan: ComputedTransferPlan = {
    assetType,
    decimals,
    amount,
    amountBaseUnits,
    nonce,
    executionRequest,
    gasLimit,
    presetOptions,
    selection,
    feeFields,
    gasCost,
    maxAmount,
    error,
  };

  return {
    ok: true,
    value: plan,
  };
}

async function buildExecutionTarget(params: { ctx: EvmHandlerDeps['ctx']; assetType: EvmTransferAssetType; recipient: string; contractAddress?: string }) {
  const { ctx, assetType, recipient, contractAddress } = params;

  if (assetType !== AssetType.Native) {
    return {
      kind: 'contract' as const,
      address: contractAddress!,
    };
  }

  const isContract = await ctx.addressValidationService.isContractAddress({
    networkType: ctx.network.networkType,
    chainId: ctx.network.chainId,
    addressValue: recipient,
  });

  return {
    kind: isContract ? ('contract' as const) : ('user' as const),
    address: recipient,
  };
}

function buildPreparedAsset(assetType: EvmTransferAssetType, asset: TransferIntent['asset'], amount: string): PreparedTransferAsset {
  if (assetType === AssetType.Native || assetType === AssetType.ERC20) {
    return { ...asset, amount };
  }

  if (assetType === AssetType.ERC1155) {
    return { ...asset, quantity: amount };
  }

  return asset;
}

function buildTransferErrorResult(error: ReviewError): ReviewTransferResult {
  return {
    summary: null,
    executionTarget: null,
    fee: null,
    sponsor: null,
    presetOptions: [],
    error: { ...error },
    canSubmit: false,
    prepared: null,
  };
}

export function createPrecheckTransferHandler(deps: EvmHandlerDeps): TransactionHandlers['precheckTransfer'] {
  return async ({ address, request }) => {
    const from = await address.getValue();
    const result = await computeTransferPlan({
      ...deps,
      from,
      intent: request.intent,
    });

    if (!result.ok) {
      return {
        maxAmount: result.maxAmount,
        error: result.error,
        canContinue: false,
      };
    }

    return {
      maxAmount: result.value.maxAmount,
      error: result.value.error,
      canContinue: !result.value.error,
    };
  };
}

export function createReviewTransferHandler(deps: EvmHandlerDeps): TransactionHandlers['reviewTransfer'] {
  return async ({ address, request }) => {
    const from = await address.getValue();
    const result = await computeTransferPlan({
      ...deps,
      from,
      intent: request.intent,
      override: request.override,
    });

    if (!result.ok) {
      return buildTransferErrorResult(result.error);
    }

    const asset = request.intent.asset;
    const { ctx } = deps;
    const { assetType, amount, nonce, executionRequest, gasLimit, presetOptions, selection, feeFields, gasCost, error } = result.value;

    const executionTarget = await buildExecutionTarget({
      ctx,
      assetType,
      recipient: request.intent.recipient,
      contractAddress: asset.contractAddress,
    });
    const preparedAsset = buildPreparedAsset(assetType, asset, amount);

    return {
      summary: {
        transfer: {
          recipient: request.intent.recipient,
          amount,
        },
        asset: {
          kind: asset.kind,
          standard: asset.standard,
          symbol: asset.symbol,
        },
        fee: {
          payableGasFee: toDisplayAmount(gasCost, 18),
        },
      },
      executionTarget,
      fee: {
        selection,
        fields: feeFields,
        gasLimit,
        nonce,
      },
      sponsor: null,
      presetOptions,
      error,
      canSubmit: !error,
      prepared: error
        ? null
        : {
            preparedKind: 'transfer',
            addressId: address.id,
            networkType: ctx.network.networkType,
            executionTarget,
            asset: preparedAsset,
            fee: {
              fields: feeFields,
              gasLimit,
              nonce,
              type: 'gasPrice' in feeFields ? 0 : 2,
            },
            executionRequest: {
              ...executionRequest,
              chainId: ctx.network.chainId,
            },
          },
    };
  };
}

export const buildTransferUnsignedTransaction: TransactionHandlers['buildTransferUnsignedTransaction'] = async (prepared) =>
  buildEvmUnsignedTransaction({
    executionRequest: prepared.executionRequest,
    fee: prepared.fee,
  });
