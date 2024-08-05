import { ProcessErrorType, processError } from '../eth';

describe('Balance', () => {
  test('Balance not enough error', async () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: tx',
        data: '"Transaction 0xf34740b7f033b13b8670df91f24537e756700a32f17e5e09a7d297701cec6859 is discarded due to out of balance, needs 9000000000420000000000000 but account balance is 90095849479680000000000"',
      },
    };
    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.balanceNotEnough);
  });
});

describe('Nonce Errors', () => {
  test('Using an already executed nonce', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: tx',
        data: '"Transaction 0x4a2cfa73267139d965ab86d41f2af16db09e62ff92a5abffd7f8e743f36f327c is discarded due to a too stale nonce"',
      },
    };
    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.tooStaleNonce);
  });
  test('Using a nonce already sent to the transaction pool', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: tx',
        data: '"tx already exist"',
      },
    };
    const parseError = processError(res.error);

    expect(parseError.errorType).toBe(ProcessErrorType.duplicateTx);
  });
  test('Using a nonce already sent to the transaction pool 2', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: tx',
        data: 'Tx with same nonce already inserted. to replace it, you need to specify a gas price > {}',
      },
    };
    const parseError = processError(res.error);

    expect(parseError.errorType).toBe(ProcessErrorType.duplicateTx);
  });

  test('Using a too large nonce', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: tx',
        data: '"Transaction 0xc875a03e1ce01268931a1a428d8f8313714ab5eb9c2b626bd327af7e5c3e8c03 is discarded due to in too distant future"',
      },
    };
    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.nonceTooHigh);
  });
});

describe('Gas Errors', () => {
  test('Gas too small (<21000) or too large (>15m)', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: tx',
        data: '"NotEnoughBaseGas { required: 21000, got: 2000 }"',
      },
    };

    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.notEnoughBaseGas);
  });

  test('Gas too small (<21000) or too large (>15m)s', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: tx',
        data: '"transaction gas 20000000 exceeds the maximum value 15000000, the half of pivot block gas limit"',
      },
    };

    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.gasExceedsLimit);
  });
});

describe('gasPrice errors', () => {
  test('Gas price set to 0', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: tx',
        data: '"ZeroGasPrice"',
      },
    };
    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.zeroGasPrice);
  });

  test('Gas price smaller than minimum gas price', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: tx',
        data: '"transaction gas price 1 less than the minimum value 20000000000"',
      },
    };
    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.gasPriceTooLow);
  });
});

describe('other errors', () => {
  test('Incorrect epochHeight', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: tx',
        data: '"EpochHeightOutOfBound { block_height: 53800739, set: 0, transaction_epoch_bound: 100000 }"',
      },
    };
    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.epochHeightOutOfBound);
  });

  test('Mismatched chainId', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: tx',
        data: '"ChainIdMismatch { expected: 1, got: 2 }"',
      },
    };

    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.chainIdMismatch);
  });

  test('Encoding or Signature Errors', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: raw',
        data: '"RlpIncorrectListLen"',
      },
    };
    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.signatureError);
  });
  test('Full Transaction Pool', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: tx',
        data: 'txpool is full',
      },
    };

    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.txPoolFull);
  });
  test('Full Transaction Pool 2', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: tx',
        data: 'Failed imported to deferred pool: Transaction Pool is full',
      },
    };

    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.txPoolFull);
  });
  test('Node in Catch-up Mode', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32077,
        message: 'Request rejected due to still in the catch up mode',
        data: null,
      },
    };

    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.nodeInCatchUp);
  });

  test('Internal Error', () => {
    const res = {
      jsonrpc: '2.0',
      id: '15922956697249514502',
      error: {
        code: -32602,
        message: 'Invalid parameters: tx',
        data: 'Failed to read account_cache from storage: {}',
      },
    };
    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.internalError);
  });
});

describe('contract errors', () => {
  test('Vm reverted', () => {
    const res = {
      jsonrpc: '2.0',
      id: 6697011089818406,
      error: {
        code: -32015,
        message: 'execution reverted: : 403. Innermost error is at 0xc9d2…100e: Vm reverted. 403.',
        data: '0xc9d2…100e: Vm reverted. 403\n0xb3a2…09ff: Vm reverted. 403',
      },
    };

    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.contractExecuteFailed);
  });

  test('notEnoughCash', () => {
    const res = {
      jsonrpc: '2.0',
      id: 9,
      error: {
        code: -32015,
        message:
          'Can not estimate: transaction execution failed, all gas will be charged (execution error: NotEnoughCash { required: 166020696663385964535000000, got: 100000000000000000000, actual_gas_cost: 100000000000000000000, max_storage_limit_cost: 0 })',
        data: 'NotEnoughCash { required: 166020696663385964535000000, got: 100000000000000000000, actual_gas_cost: 100000000000000000000, max_storage_limit_cost: 0 }',
      },
    };
    const parseError = processError(res.error);
    expect(parseError.errorType).toBe(ProcessErrorType.notEnoughCash);
  });
});
