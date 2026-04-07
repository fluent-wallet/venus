import type { IActivityTransaction } from '@service/core';

const DAY_MILLISECONDS = 1000 * 60 * 60 * 24;

export type ActivityContentRow =
  | { key: string; kind: 'activity-date'; year: number; month: number; day: number; marginTop: number }
  | { key: string; kind: 'activity-item'; tx: IActivityTransaction };

function formatActivityDate(time: number) {
  const date = new Date(time);

  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
  };
}

export function buildActivityContentRows({
  finishedTxs,
  unfinishedTxs,
}: {
  finishedTxs: IActivityTransaction[];
  unfinishedTxs: IActivityTransaction[];
}): ActivityContentRow[] {
  let activeDay = 0;
  const rows: ActivityContentRow[] = unfinishedTxs.map((tx) => ({
    key: `pending-${tx.id}`,
    kind: 'activity-item',
    tx,
  }));

  for (const tx of finishedTxs) {
    const baseMs = tx.executedAtMs ?? tx.createdAtMs;
    const time = Math.floor(baseMs / DAY_MILLISECONDS) * DAY_MILLISECONDS;

    if (activeDay !== time) {
      activeDay = time;
      const formatted = formatActivityDate(time);

      rows.push({
        key: `activity-date-${formatted.year}-${formatted.month}-${formatted.day}`,
        kind: 'activity-date',
        marginTop: rows.length > 0 ? 24 : 0,
        ...formatted,
      });
    }

    rows.push({
      key: tx.id,
      kind: 'activity-item',
      tx,
    });
  }

  return rows;
}
