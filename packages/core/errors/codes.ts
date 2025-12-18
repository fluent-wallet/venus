export const MM_DUPLICATE_MODULE_ID = 'MM_DUPLICATE_MODULE_ID' as const;
export const MM_MISSING_DEPENDENCY = 'MM_MISSING_DEPENDENCY' as const;
export const MM_CYCLE_DEPENDENCY = 'MM_CYCLE_DEPENDENCY' as const;

export const MM_ALREADY_STARTED = 'MM_ALREADY_STARTED' as const;
export const MM_NOT_STARTED = 'MM_NOT_STARTED' as const;

export const MM_START_FAILED = 'MM_START_FAILED' as const;
export const MM_STOP_FAILED = 'MM_STOP_FAILED' as const;

export const EVENT_PAYLOAD_NOT_SERIALIZABLE = 'EVENT_PAYLOAD_NOT_SERIALIZABLE' as const;
export type ModuleManagerErrorCode =
  | typeof MM_DUPLICATE_MODULE_ID
  | typeof MM_MISSING_DEPENDENCY
  | typeof MM_CYCLE_DEPENDENCY
  | typeof MM_ALREADY_STARTED
  | typeof MM_NOT_STARTED
  | typeof MM_START_FAILED
  | typeof MM_STOP_FAILED;

export type EventErrorCode = typeof EVENT_PAYLOAD_NOT_SERIALIZABLE;
