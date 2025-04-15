import { ProcessErrorType, processError } from '@core/utils/eth';
import { t } from 'i18next';
import {
  ExceedsBlockGasLimitError,
  NonceTooHighError,
  NonceTooStaleError,
  OutOfBalanceError,
  RPCError,
  TransactionChainIdMismatchError,
  TransactionNotEnoughBaseGasError,
  TransactionUnderpricedError,
  TransactionZeroGasPriceError,
  UnrecoverablePubkeyError,
  coreSpaceErrors,
  eSpaceErrors,
} from '@cfxjs/rpc-errors';
const rpcError = new RPCError();
rpcError.registerError(coreSpaceErrors);
rpcError.registerError(eSpaceErrors);

const matchRPCErrorMessage = (error: { message?: string; data?: string; code?: number }) => {
  if (typeof error.code !== 'undefined') {
    const parsedError = rpcError.parse({ code: error.code, message: error.message || '', data: error.data || '' });

    if (parsedError instanceof OutOfBalanceError) {
      return t('tx.error.balanceNotEnough');
    }

    if (parsedError instanceof NonceTooStaleError) {
      return t('tx.error.tooStaleNonce');
    }

    if (parsedError instanceof NonceTooHighError) {
      return t('tx.error.nonceTooHigh');
    }

    if (parsedError instanceof TransactionNotEnoughBaseGasError) {
      let gasLimit = '21000';
      if (error.data) {
        const regex = /required: (\d+)/;
        const match = error.data.match(regex);
        if (match && match?.length > 1) {
          gasLimit = match[1];
        }
      }
      return t('tx.error.notEnoughBaseGas', { gasLimit });
    }

    if (parsedError instanceof ExceedsBlockGasLimitError) {
      return t('tx.error.gasExceedsLimit');
    }

    if (parsedError instanceof TransactionZeroGasPriceError) {
      return t('tx.error.zeroGasPrice');
    }

    if (parsedError instanceof TransactionUnderpricedError) {
      return t('tx.error.gasPriceTooLow');
    }

    if (parsedError instanceof TransactionChainIdMismatchError) {
      return t('tx.error.chainIdMismatch');
    }

    if (parsedError instanceof UnrecoverablePubkeyError) {
      return t('tx.error.signatureError');
    }
  }

  const msg = error.data || error.message;

  const parseError = processError(error);
  switch (parseError.errorType) {
    case ProcessErrorType.balanceNotEnough:
      return t('tx.error.balanceNotEnough');
    case ProcessErrorType.tooStaleNonce:
      return t('tx.error.tooStaleNonce');
    case ProcessErrorType.nonceTooHigh:
      return t('tx.error.nonceTooHigh');
    case ProcessErrorType.notEnoughBaseGas: {
      let gasLimit = '21000';
      if (error.data) {
        const regex = /required: (\d+)/;
        const match = error.data.match(regex);
        if (match && match?.length > 1) {
          gasLimit = match[1];
        }
      }
      return t('tx.error.notEnoughBaseGas', { gasLimit });
    }
    case ProcessErrorType.gasExceedsLimit:
      return t('tx.error.gasExceedsLimit');
    case ProcessErrorType.zeroGasPrice:
      return t('tx.error.zeroGasPrice');
    case ProcessErrorType.gasPriceTooLow:
      return t('tx.error.gasPriceTooLow');
    case ProcessErrorType.chainIdMismatch:
      return t('tx.error.chainIdMismatch');
    case ProcessErrorType.signatureError:
      return t('tx.error.signatureError');
    case ProcessErrorType.txPoolFull:
      return t('tx.error.txPoolFull');
    case ProcessErrorType.nodeInCatchUp:
      return t('tx.error.nodeInCatchUp');
    case ProcessErrorType.contractExecuteFailed:
      return t('tx.error.contractExecuteFailed', { msg });

    default:
      return t('tx.error.unknownError', { msg });
  }
};

export default matchRPCErrorMessage;
