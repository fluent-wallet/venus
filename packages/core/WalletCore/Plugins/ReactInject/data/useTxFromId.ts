import { useAtomValue } from 'jotai';
import { atomFamily, atomWithObservable } from 'jotai/utils';
import { of } from 'rxjs';
import { observeTxById } from '../../../../database/models/Tx/query';

const txAtomFromId = atomFamily((txId: string | undefined | null) =>
  atomWithObservable(() => (txId ? observeTxById(txId) : of(null)), { initialValue: null! }),
);

export const useTxFromId = (txId: string | undefined | null) => {
  const txs = useAtomValue(txAtomFromId(txId));
  return txs ? txs[0] : null;
};
