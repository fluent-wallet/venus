import { ASSET_TYPE } from '@core/types';
import type { InitialSendFlowState, SendEntry, TransferDraft } from './types';
import { EMPTY_TRANSFER_DRAFT } from './types';

function requireNonBlank(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Send entry requires ${fieldName}.`);
  }

  return trimmed;
}

function buildDraft(patch: Partial<TransferDraft>): TransferDraft {
  return {
    ...EMPTY_TRANSFER_DRAFT,
    ...patch,
  };
}

export function buildInitialSendFlowStateFromEntry(entry: SendEntry): InitialSendFlowState {
  if (entry.kind === 'empty') {
    return { draft: EMPTY_TRANSFER_DRAFT, initialStep: 'recipient' };
  }

  const recipient = requireNonBlank(entry.recipient, 'recipient');

  if (entry.kind === 'recipient') {
    return {
      draft: buildDraft({ recipient }),
      initialStep: 'asset',
      assetSearchText: entry.assetSearchText?.trim() || undefined,
    };
  }

  if (entry.kind === 'asset') {
    if (entry.asset.type === ASSET_TYPE.ERC721) {
      return {
        draft: buildDraft({
          recipient,
          asset: entry.asset,
          amountIntent: {
            kind: 'exact',
            amount: '1',
          },
        }),
        initialStep: 'review',
      };
    }

    return {
      draft: buildDraft({
        recipient,
        asset: entry.asset,
      }),
      initialStep: 'amount',
    };
  }

  return {
    draft: buildDraft({
      recipient,
      asset: entry.asset,
      amountIntent:
        entry.amountIntent.kind === 'max'
          ? entry.amountIntent
          : {
              kind: 'exact',
              amount: requireNonBlank(entry.amountIntent.amount, 'amountIntent.amount'),
            },
    }),
    initialStep: 'review',
  };
}
