import { ProcessErrorType, processError } from '@core/utils/eth';

const matchRPCErrorMessage = (error: { message?: string; data?: string }) => {
  const msg = error.data || error.message;

  const parseError = processError(error);
  switch (parseError.errorType) {
    case ProcessErrorType.balanceNotEnough:
      return 'Insufficient CFX for gas fee';
    case ProcessErrorType.tooStaleNonce:
      return 'The nonce transaction has been executed, change it to the latest one.';
    case ProcessErrorType.nonceTooHigh:
      return 'Nonce is too large, change it to the latest one';
    case ProcessErrorType.notEnoughBaseGas:
      return 'Gas limit is invalid, reset to >= 21000';
    case ProcessErrorType.gasExceedsLimit:
      return 'Gas limit is too large, reset to < 15000000';
    case ProcessErrorType.zeroGasPrice:
      return 'Gas price is invalid, reset it.';
    case ProcessErrorType.gasPriceTooLow:
      return 'Gas price is too low.';
    case ProcessErrorType.chainIdMismatch:
      return 'Unable to find chain information.';
    case ProcessErrorType.signatureError:
      return 'Signature Error.';
    case ProcessErrorType.txPoolFull:
      return 'Transactions are too crowded, please increase gas price.';
    case ProcessErrorType.nodeInCatchUp:
      return 'Node is not working, change the node or waiting.';
    case ProcessErrorType.notEnoughCash:
      return 'Insufficient CFX for gas fee.';
    case ProcessErrorType.executeFailed:
      return `Contract execution failed, info:${msg}`;

    default:
      return `Unknown error: ${msg}`;
  }
};

export default matchRPCErrorMessage;
