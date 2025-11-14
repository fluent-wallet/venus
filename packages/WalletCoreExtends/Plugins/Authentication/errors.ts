export enum AuthenticationErrorCode {
  AUTH_TYPE = 'AUTH_TYPE_NOT_SET',

  BIOMETRICS_FAILED = 'BIOMETRICS_FAILED',
  BIOMETRICS_CANCELED = 'BIOMETRICS_CANCELED',
  BIOMETRICS_UNKNOWN = 'BIOMETRICS_UNKNOWN',

  PASSWORD_REQUEST_CANCELED = 'PASSWORD_REQUEST_CANCELED',
  PASSWORD_VERIFICATION_FAILED = 'PASSWORD_VERIFICATION_FAILED',
}

export interface AuthenticationErrorInfo {
  code: AuthenticationErrorCode;
  message: string;
}

export class AuthenticationError extends Error {
  public readonly code: AuthenticationErrorCode;

  constructor(info: AuthenticationErrorInfo) {
    super(info.message);
    this.code = info.code;
    this.name = 'AuthenticationError';
  }
}

export const authTypeError = (message?: string) => {
  return new AuthenticationError({
    code: AuthenticationErrorCode.AUTH_TYPE,
    message: message || 'Authentication type not set or unsupported.',
  });
};

export const biometricsFailedError = (message?: string) => {
  return new AuthenticationError({
    code: AuthenticationErrorCode.BIOMETRICS_FAILED,
    message: message || 'Biometrics authentication failed.',
  });
};

export const biometricsCanceledError = (message?: string) => {
  return new AuthenticationError({
    code: AuthenticationErrorCode.BIOMETRICS_CANCELED,
    message: message || 'Biometrics authentication was canceled by the user.',
  });
};

export const biometricsUnknownError = (message?: string) => {
  return new AuthenticationError({
    code: AuthenticationErrorCode.BIOMETRICS_UNKNOWN,
    message: message || 'An unknown error occurred during biometrics authentication.',
  });
};

export const passwordRequestCanceledError = (message?: string) => {
  return new AuthenticationError({
    code: AuthenticationErrorCode.PASSWORD_REQUEST_CANCELED,
    message: message || 'Password request was canceled.',
  });
};

export const passwordVerificationFailedError = (message?: string) => {
  return new AuthenticationError({
    code: AuthenticationErrorCode.PASSWORD_VERIFICATION_FAILED,
    message: message || 'Password verification failed.',
  });
};

// Utility function

export const isAuthenticationError = (error: unknown): error is AuthenticationError => {
  return error instanceof AuthenticationError;
};

export const isAuthenticationCanceledError = (error: AuthenticationError) => {
  return error.code === AuthenticationErrorCode.BIOMETRICS_CANCELED || error.code === AuthenticationErrorCode.PASSWORD_REQUEST_CANCELED;
};
