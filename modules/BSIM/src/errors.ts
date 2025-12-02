export type BSIMErrorMetadata = {
  reason?: string;
};

export class BSIMError extends Error {
  public readonly reason?: string;

  constructor(
    public code: string,
    public message: string,
    metadata?: BSIMErrorMetadata,
  ) {
    super(message);
    this.code = code;
    this.message = message;
    if (metadata?.reason) {
      this.reason = metadata.reason;
    }
  }
}

export class ErrorCoinTypesNotSupported extends BSIMError {
  static code = '1001';
  constructor(
    public code: string,
    public message: string,
  ) {
    super(code, message);
  }
}

export class ErrorGenerateNewKey extends BSIMError {
  static code = '1002';
  constructor(
    public code: string,
    public message: string,
  ) {
    super(code, message);
  }
}

export class ErrorGetPublicKey extends BSIMError {
  static code = '1003';
  constructor(
    public code: string,
    public message: string,
  ) {
    super(code, message);
  }
}

export class ErrorGetBSIMVersion extends BSIMError {
  static code = '1004';
  constructor(
    public code: string,
    public message: string,
  ) {
    super(code, message);
  }
}

export class ErrorVerifyBPIN extends BSIMError {
  static code = '1005';
  constructor(
    public code: string,
    public message: string,
  ) {
    super(code, message);
  }
}

export class ErrorUpdateBPIN extends BSIMError {
  static code = '1006';
  constructor(
    public code: string,
    public message: string,
  ) {
    super(code, message);
  }
}

export class ErrorSignCoinTypeNotFind extends BSIMError {
  static code = '1007';
  constructor(
    public code: string,
    public message: string,
  ) {
    super(code, message);
  }
}

export class ErrorSignMessage extends BSIMError {
  static code = '1008';
  constructor(
    public code: string,
    public message: string,
  ) {
    super(code, message);
  }
}

export class ErrorSignGetPublicKey extends BSIMError {
  static code = '1009';
  constructor(
    public code: string,
    public message: string,
  ) {
    super(code, message);
  }
}
