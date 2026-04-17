import { buildTransactionPayload } from '@core/chains/utils/transactionBuilder';
import { AssetType, type ConfluxChainProviderLike, type ConfluxUnsignedTransaction, type Hex } from '@core/types';
import { decode } from '@core/utils/address';
import { NetworkType } from '@core/utils/consts';
import * as OxValue from 'ox/Value';
import type {
  ExecutionTarget,
  PreparedTransferAsset,
  ReviewError,
  ReviewTransferResult,
  SponsorSnapshot,
  TransactionReviewOverride,
  TransferIntent,
} from '../../stagedTypes';
import { buildPresetOptions, getFeeUnitPrice, pickFee, toDisplayAmount } from '../evm/shared';
import type { TransactionHandlers } from '../types';
import { FIXED_NATIVE_TRANSFER_GAS_LIMIT, FIXED_NATIVE_TRANSFER_STORAGE_LIMIT, getStorageCollateralDrip } from './shared';

type ConfluxTransferAssetType = AssetType.Native | AssetType.ERC20;

type ComputedTransferPlan = {
  assetType: ConfluxTransferAssetType;
  amount: string;
  amountBaseUnits: bigint;
  nonce: number;
  executionRequest: ReturnType<typeof buildTransactionPayload>;
  executionTarget: ExecutionTarget;
  gasLimit: string;
  storageLimit: string;
  presetOptions: ReturnType<typeof buildPresetOptions>;
  selection: ReturnType<typeof pickFee>['selection'];
  feeFields: ReturnType<typeof pickFee>['fields'];
  payableGasFee: bigint;
  payableStorageCollateral: bigint;
  sponsor: SponsorSnapshot;
  maxAmount: string;
  error: ReviewError | null;
};

type TransferPlanResult = { ok: true; value: ComputedTransferPlan } | { ok: false; error: ReviewError; maxAmount: string | null };

function getTransferAssetType(standard: TransferIntent['asset']['standard']): ConfluxTransferAssetType | null {
  if (standard === 'native') return AssetType.Native;
  if (standard === 'crc20') return AssetType.ERC20;
  return null;
}

function getTransferAssetDecimals(assetType: ConfluxTransferAssetType, asset: TransferIntent['asset']): number | null {
  if (assetType === AssetType.Native) return 18;
  if (assetType === AssetType.ERC20) return typeof asset.decimals === 'number' ? asset.decimals : null;
  return null;
}
function formatTransferAmount(balance: bigint, decimals: number) {
  return toDisplayAmount(balance, decimals);
}

function buildExecutionTarget(params: { assetType: ConfluxTransferAssetType; recipient: string; contractAddress?: string }): ExecutionTarget | null {
  const { assetType, recipient, contractAddress } = params;

  if (assetType !== AssetType.Native) {
    return contractAddress ? { kind: 'contract', address: contractAddress } : null;
  }

  try {
    const type = decode(recipient).type;
    if (type === 'user' || type === 'contract' || type === 'builtin') {
      return { kind: type, address: recipient };
    }
    return null;
  } catch {
    return null;
  }
}

function isSimpleNativeUserTransfer(params: { assetType: ConfluxTransferAssetType; executionTarget: ExecutionTarget; data: Hex }) {
  return params.assetType === AssetType.Native && params.executionTarget.kind === 'user' && params.data === '0x';
}

function buildPreparedAsset(assetType: ConfluxTransferAssetType, asset: TransferIntent['asset'], amount: string): PreparedTransferAsset {
  if (assetType === AssetType.Native || assetType === AssetType.ERC20) {
    return { ...asset, amount };
  }

  return asset;
}

async function resolveSponsorState(params: {
  chainProvider: ConfluxChainProviderLike;
  from: string;
  executionTarget: ExecutionTarget;
  gasLimit: string;
  storageLimit: string;
  feeFields: ReturnType<typeof pickFee>['fields'];
}): Promise<
  | {
      sponsor: SponsorSnapshot;
      payableGasFee: bigint;
      payableStorageCollateral: bigint;
    }
  | {
      error: ReviewError;
    }
> {
  const feeUnitPrice = getFeeUnitPrice(params.feeFields);
  const gasFee = feeUnitPrice * BigInt(params.gasLimit);
  const storageCollateral = getStorageCollateralDrip(params.storageLimit);

  if (params.executionTarget.kind !== 'contract') {
    return {
      sponsor: {
        gasSponsored: false,
        storageSponsored: false,
      },
      payableGasFee: gasFee,
      payableStorageCollateral: storageCollateral,
    };
  }

  try {
    const response = (await params.chainProvider.rpc.request('cfx_checkBalanceAgainstTransaction', [
      params.from,
      params.executionTarget.address,
      params.gasLimit,
      `0x${feeUnitPrice.toString(16)}`,
      params.storageLimit,
      'latest_state',
    ])) as {
      willPayCollateral?: boolean;
      willPayTxFee?: boolean;
    };

    const willPayCollateral = response?.willPayCollateral !== false;
    const willPayTxFee = response?.willPayTxFee !== false;

    return {
      sponsor: {
        gasSponsored: !willPayTxFee,
        storageSponsored: !willPayCollateral,
      },
      payableGasFee: willPayTxFee ? gasFee : 0n,
      payableStorageCollateral: willPayCollateral ? storageCollateral : 0n,
    };
  } catch {
    return {
      error: {
        code: 'sponsor_check_failed',
        message: 'Failed to check sponsor state.',
      },
    };
  }
}

async function computeTransferPlan(params: {
  ctx: { network: { chainId: string } };
  chainProvider: ConfluxChainProviderLike;
  from: string;
  intent: TransferIntent;
  override?: TransactionReviewOverride;
}): Promise<TransferPlanResult> {
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
      error: { code: 'unsupported', message: 'Unsupported Conflux asset standard.' },
    };
  }

  if (assetType === AssetType.ERC20 && !asset.contractAddress) {
    return {
      ok: false,
      maxAmount: null,
      error: { code: 'unsupported', message: 'Missing contract address.' },
    };
  }

  const decimals = getTransferAssetDecimals(assetType, asset);
  if (decimals == null) {
    return {
      ok: false,
      maxAmount: null,
      error: { code: 'unsupported', message: 'Missing decimals for CRC20 asset.' },
    };
  }

  const nonce = override?.nonce ?? (await chainProvider.getNonce(from));
  const balanceRequests =
    assetType === AssetType.Native
      ? [{ assetType: AssetType.Native as const }]
      : [{ assetType: AssetType.Native as const }, { assetType: AssetType.ERC20 as const, contractAddress: asset.contractAddress! }];

  const balances = await chainProvider.readFungibleAssetBalances(from, balanceRequests);
  const nativeBalance = BigInt(balances[0] ?? '0x0');
  const assetBalance = assetType === AssetType.Native ? nativeBalance : BigInt(balances[1] ?? '0x0');
  const assetMaxAmount = formatTransferAmount(assetBalance, decimals);

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
  });

  const executionTarget = buildExecutionTarget({
    assetType,
    recipient: intent.recipient,
    contractAddress: estimateRequest.to,
  });

  if (!executionTarget) {
    return {
      ok: false,
      maxAmount: null,
      error: { code: 'invalid_recipient', message: 'The recipient address is invalid.' },
    };
  }

  const simpleNativeUserTransfer = isSimpleNativeUserTransfer({
    assetType,
    executionTarget,
    data: estimateRequest.data,
  });

  const estimate = await chainProvider.estimateFee({
    chainType: NetworkType.Conflux,
    payload: {
      ...estimateRequest,
      chainId: ctx.network.chainId,
      nonce,
      ...(simpleNativeUserTransfer
        ? {
            gasLimit: override?.gasLimit ?? FIXED_NATIVE_TRANSFER_GAS_LIMIT,
            storageLimit: override?.storageLimit ?? FIXED_NATIVE_TRANSFER_STORAGE_LIMIT,
          }
        : {
            ...(override?.gasLimit ? { gasLimit: override.gasLimit } : {}),
            ...(override?.storageLimit ? { storageLimit: override.storageLimit } : {}),
          }),
    },
  });

  const gasLimit = override?.gasLimit ?? (simpleNativeUserTransfer ? FIXED_NATIVE_TRANSFER_GAS_LIMIT : estimate.gasLimit);
  const storageLimit = override?.storageLimit ?? (simpleNativeUserTransfer ? FIXED_NATIVE_TRANSFER_STORAGE_LIMIT : estimate.storageLimit);

  const presetOptions = buildPresetOptions({
    gasLimit,
    gasPrice: estimate.gasPrice,
    maxFeePerGas: estimate.maxFeePerGas,
    maxPriorityFeePerGas: estimate.maxPriorityFeePerGas,
  });
  const { selection, fields: feeFields } = pickFee(presetOptions, override);

  const fullGasFee = getFeeUnitPrice(feeFields) * BigInt(gasLimit);
  const fullStorageCollateral = getStorageCollateralDrip(storageLimit);
  const fullTxFee = fullGasFee + fullStorageCollateral;

  const maxAmountBaseUnits = assetType === AssetType.Native ? (nativeBalance > fullTxFee ? nativeBalance - fullTxFee : 0n) : assetBalance;
  const maxAmount = formatTransferAmount(maxAmountBaseUnits, decimals);

  const sponsorState = await resolveSponsorState({
    chainProvider,
    from,
    executionTarget,
    gasLimit,
    storageLimit,
    feeFields,
  });

  if ('error' in sponsorState) {
    return {
      ok: false,
      maxAmount,
      error: sponsorState.error,
    };
  }

  const amount = intent.amount.kind === 'exact' ? intent.amount.amount : maxAmount;
  const amountBaseUnits = intent.amount.kind === 'exact' ? requestedAmountBaseUnits! : maxAmountBaseUnits;
  const payableFee = sponsorState.payableGasFee + sponsorState.payableStorageCollateral;

  let error: ReviewError | null = null;
  if (assetType === AssetType.Native) {
    if (amountBaseUnits <= 0n) {
      error = { code: 'insufficient_native_for_fee', message: 'Insufficient native balance for fee.' };
    } else if (nativeBalance < amountBaseUnits + payableFee) {
      error = { code: 'insufficient_native_for_fee', message: 'Insufficient native balance.' };
    }
  } else if (nativeBalance < payableFee) {
    error = { code: 'insufficient_native_for_fee', message: 'Insufficient native balance for fee.' };
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
  });

  return {
    ok: true,
    value: {
      assetType,
      amount,
      amountBaseUnits,
      nonce,
      executionRequest,
      executionTarget,
      gasLimit,
      storageLimit,
      presetOptions,
      selection,
      feeFields,
      payableGasFee: sponsorState.payableGasFee,
      payableStorageCollateral: sponsorState.payableStorageCollateral,
      sponsor: sponsorState.sponsor,
      maxAmount,
      error,
    },
  };
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

export function createPrecheckTransferHandler(params: {
  ctx: { network: { chainId: string } };
  chainProvider: ConfluxChainProviderLike;
}): TransactionHandlers['precheckTransfer'] {
  const { ctx, chainProvider } = params;

  return async ({ address, request }) => {
    const from = await address.getValue();
    const result = await computeTransferPlan({
      ctx,
      chainProvider,
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

export function createReviewTransferHandler(params: {
  ctx: { network: { chainId: string } };
  chainProvider: ConfluxChainProviderLike;
}): TransactionHandlers['reviewTransfer'] {
  const { ctx, chainProvider } = params;

  return async ({ address, request }) => {
    const from = await address.getValue();
    const result = await computeTransferPlan({
      ctx,
      chainProvider,
      from,
      intent: request.intent,
      override: request.override,
    });

    if (!result.ok) {
      return buildTransferErrorResult(result.error);
    }

    const asset = request.intent.asset;
    const {
      assetType,
      amount,
      nonce,
      executionRequest,
      executionTarget,
      gasLimit,
      storageLimit,
      presetOptions,
      selection,
      feeFields,
      sponsor,
      payableGasFee,
      payableStorageCollateral,
      error,
    } = result.value;
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
          payableGasFee: toDisplayAmount(payableGasFee, 18),
          payableStorageCollateral: toDisplayAmount(payableStorageCollateral, 18),
        },
      },
      executionTarget,
      fee: {
        selection,
        fields: feeFields,
        gasLimit,
        storageLimit,
        nonce,
      },
      sponsor,
      presetOptions,
      error,
      canSubmit: !error,
      prepared: error
        ? null
        : {
            preparedKind: 'transfer',
            addressId: address.id,
            networkType: NetworkType.Conflux,
            executionTarget,
            asset: preparedAsset,
            fee: {
              fields: feeFields,
              gasLimit,
              storageLimit,
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

export function createBuildTransferUnsignedTransactionHandler(params: {
  chainProvider: ConfluxChainProviderLike;
}): TransactionHandlers['buildTransferUnsignedTransaction'] {
  const { chainProvider } = params;

  return async (prepared) => {
    const draft: ConfluxUnsignedTransaction = {
      chainType: NetworkType.Conflux,
      payload: {
        ...prepared.executionRequest,
        gasLimit: prepared.fee.gasLimit,
        storageLimit: prepared.fee.storageLimit,
        nonce: prepared.fee.nonce,
        type: prepared.fee.type ?? ('gasPrice' in prepared.fee.fields ? 0 : 2),
        ...('gasPrice' in prepared.fee.fields
          ? {
              gasPrice: prepared.fee.fields.gasPrice,
            }
          : {
              maxFeePerGas: prepared.fee.fields.maxFeePerGas,
              maxPriorityFeePerGas: prepared.fee.fields.maxPriorityFeePerGas,
            }),
        ...(prepared.fee.epochHeight == null ? {} : { epochHeight: prepared.fee.epochHeight }),
      },
    };

    return chainProvider.prepareUnsignedTransaction(draft);
  };
}
