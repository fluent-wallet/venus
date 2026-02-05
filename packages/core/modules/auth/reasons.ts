export const AUTH_REASON = {
  SIGN_TX: 'sign_tx',
  SIGN_PERSONAL_MESSAGE: 'sign_personal_message',
  SIGN_TYPED_DATA_V4: 'sign_typed_data_v4',
} as const;

export type AuthReason = (typeof AUTH_REASON)[keyof typeof AUTH_REASON];
