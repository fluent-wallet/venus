export const APDU_STATUS = {
  SUCCESS: '9000',
  PENDING: '6300',
} as const;

export type ApduStatusCode = (typeof APDU_STATUS)[keyof typeof APDU_STATUS];

export const CARD_ERROR_MESSAGES = {
  '9000': 'Execution success',
  A000: 'Unknown error',
  '6E00': 'Failed to call BSIM. Error code: 6E00',
  '6D00': 'Failed to call BSIM. Error code: 6D00',
  '6700': 'Failed to call BSIM. Error code: 6700',
  '6A80': 'Failed to call BSIM. Error code: 6A80',
  '6A84': 'Failed to call BSIM. Error code: 6A84',
  '6A86': 'Failed to call BSIM. Error code: 6A86',
  '6A88': 'Wrong BPIN, unable to complete authentication. Error code: 6A88',
  '6982': 'BSIM has not yet completed certification. Error code: 6982',
  '6983': 'BSIM card is locked. Error code: 6983',
  '6984': 'Failed to call BSIM. Error code: 6984',
  '6985': 'BSIM error. Error code: 6985',
  '6300': 'Authentication failed.',
  '63C1': 'Authentication failed, 1 attempt remaining.',
  '63C2': 'Authentication failed, 2 attempts remaining.',
  '63C3': 'Authentication failed, 3 attempts remaining.',
  '63C4': 'Authentication failed, 4 attempts remaining.',
  '63C5': 'Authentication failed, 5 attempts remaining.',
  '63C6': 'Authentication failed, 6 attempts remaining.',
  '63C7': 'Authentication failed, 7 attempts remaining.',
  '63C8': 'Authentication failed, 8 attempts remaining.',
  '63C9': 'Authentication failed, 9 attempts remaining.',
  '63CA': 'Authentication failed, 10 attempts remaining.',
} as const;

export type CardErrorCode = keyof typeof CARD_ERROR_MESSAGES;

export const isCardErrorCode = (value: string): value is CardErrorCode => {
  if (!value) return false;
  return Object.hasOwn(CARD_ERROR_MESSAGES, value.toUpperCase());
};

export const resolveStatusMessage = (status: string): string | undefined => {
  if (!status) {
    return undefined;
  }
  const key = status.toUpperCase();
  return (CARD_ERROR_MESSAGES as Record<string, string>)[key];
};

export const isSuccessStatus = (status: string): boolean => status?.toUpperCase() === APDU_STATUS.SUCCESS;
export const isPendingStatus = (status: string): boolean => status?.toUpperCase() === APDU_STATUS.PENDING;
export const isProactiveStatus = (status: string): boolean => status?.toUpperCase().startsWith('91');
