import { BSIMError, CARD_ERROR_MESSAGES } from 'react-native-bsim';

export { BSIMError };

const CARD_ERROR_LOOKUP: Record<string, string> = { ...CARD_ERROR_MESSAGES };

export const BSIM_ERRORS: Record<string, string> = {
  ...CARD_ERROR_LOOKUP,
  A000: 'BSIM error, unknown error. Error code: A000',
  DEFAULT: 'BSIM error, unknown error.',
  CANCEL: 'User canceled the operation.',
};

export const BSIM_SUPPORT_ACCOUNT_LIMIT = 127; // by now bism only support 127 accounts;

export class BSIMErrorEndTimeout extends BSIMError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = 'TimeoutError';
    this.code = code;
  }
}
