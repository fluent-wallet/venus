// shouldDiscard means should stop tracking this tx
// error from geth txpool error
// https://github.com/ethereum/go-ethereum/blob/2d20fed893faa894f50af709349b13b6ad9b45db/core/tx_pool.go#L56
// https://github.com/ethereum/go-ethereum/blob/2d20fed893faa894f50af709349b13b6ad9b45db/light/txpool.go#L356
// https://github.com/ethereum/go-ethereum/blob/2d20fed893faa894f50af709349b13b6ad9b45db/core/error.go#L48
// https://github.com/ethereum/go-ethereum/blob/2d20fed893faa894f50af709349b13b6ad9b45db/core/state_transition.go#L214

export enum ProcessErrorType {
  unknownError = 'unknownError',
  duplicateTx = 'duplicateTx',
  replaceUnderpriced = 'replaceUnderpriced',
  txPoolFull = 'txPoolFull',
  gasExceedsLimit = 'gasExceedsLimit',
  gasLimitReached = 'gasLimitReached',
  oversizedData = 'oversizedData',
  tooStaleNonce = 'tooStaleNonce',
  nonceTooHigh = 'nonceTooHigh',
  nonceMax = 'nonceMax',
  zeroGasPrice = 'zeroGasPrice',
  gasPriceTooLow = 'gasPriceTooLow',
  intrinsicGas = 'intrinsicGas',
  txTypeNotSupported = 'txTypeNotSupported',
  feeCapVeryHigh = 'feeCapVeryHigh',
  feeCapTooLow = 'feeCapTooLow',
  tipAboveFeeCap = 'tipAboveFeeCap',
  tipVeryHigh = 'tipVeryHigh',
  epochHeightOutOfBound = 'epochHeightOutOfBound',
  notEnoughBaseGas = 'notEnoughBaseGas',
  chainIdMismatch = 'chainIdMismatch',
  balanceNotEnough = 'balanceNotEnough',
  signatureError = 'signatureError',
  nodeInCatchUp = 'nodeInCatchUp',
  internalError = 'internalError',
  contractExecuteFailed = 'contractExecuteFailed',
  notEnoughCash = 'notEnoughCash',
  replacedByAnotherTx = 'replacedByAnotherTx',
  /** for tx tracker, not from error message */
  executeFailed = 'executeFailed',
}

export const processError = (err: unknown): { errorType: ProcessErrorType; shouldDiscard: boolean } => {
  if (typeof (err as any)?.data === 'string' || typeof (err as any)?.message === 'string') {
    const errStr = (err as any).data || (err as any).message || '';
    if (
      /known transaction/i.test(errStr) ||
      /tx already exist/i.test(errStr) ||
      /already known/i.test(errStr) ||
      /transaction with the same hash was already imported/i.test(errStr)
    )
      return { errorType: ProcessErrorType.duplicateTx, shouldDiscard: false };
    if (
      /replacement transaction underpriced/i.test(errStr) ||
      /gas price too low to replace/i.test(errStr) ||
      /Tx with same nonce already inserted. to replace it, you need to specify a gas price/i.test(errStr)
    )
      return { errorType: ProcessErrorType.replaceUnderpriced, shouldDiscard: true };

    // ErrUnderpriced is returned if a transaction's gas price is below the minimum
    if (/transaction underpriced/i.test(errStr) || /gas price.*less than the minimum value/i.test(errStr))
      return { errorType: ProcessErrorType.gasPriceTooLow, shouldDiscard: true };

    if (/pool is full/i.test(errStr)) return { errorType: ProcessErrorType.txPoolFull, shouldDiscard: true };
    if (/exceeds block gas limit/i.test(errStr)) return { errorType: ProcessErrorType.gasExceedsLimit, shouldDiscard: true };
    // https://github.com/ethereum/go-ethereum/blob/2d20fed893faa894f50af709349b13b6ad9b45db/core/error.go#L58
    if (/gas limit reached/i.test(errStr)) return { errorType: ProcessErrorType.gasLimitReached, shouldDiscard: false };
    if (/oversized data/i.test(errStr)) return { errorType: ProcessErrorType.oversizedData, shouldDiscard: true };
    if (/nonce too low/i.test(errStr) || /too stale nonce/i.test(errStr)) return { errorType: ProcessErrorType.tooStaleNonce, shouldDiscard: true };
    if (/nonce too high/i.test(errStr) || /is discarded due to in too distant futur/i.test(errStr))
      return { errorType: ProcessErrorType.nonceTooHigh, shouldDiscard: true };
    if (/nonce has max value/i.test(errStr)) return { errorType: ProcessErrorType.nonceMax, shouldDiscard: true };
    if (/insufficient funds/i.test(errStr) || /is discarded due to out of balance/i.test(errStr))
      return { errorType: ProcessErrorType.balanceNotEnough, shouldDiscard: true };
    if (/ZeroGasPrice/i.test(errStr)) return { errorType: ProcessErrorType.zeroGasPrice, shouldDiscard: true };
    if (/intrinsic gas too low/i.test(errStr)) return { errorType: ProcessErrorType.intrinsicGas, shouldDiscard: true };
    if (/transaction type not supported/i.test(errStr)) return { errorType: ProcessErrorType.txTypeNotSupported, shouldDiscard: true };
    if (/max fee per gas higher than/i.test(errStr)) return { errorType: ProcessErrorType.feeCapVeryHigh, shouldDiscard: true };
    if (/max fee per gas less than block base fee/i.test(errStr)) return { errorType: ProcessErrorType.feeCapTooLow, shouldDiscard: true };
    if (/max priority fee per gas higher than max fee per gas/i.test(errStr)) return { errorType: ProcessErrorType.tipAboveFeeCap, shouldDiscard: true };
    if (/max priority fee per gas higher than/i.test(errStr)) return { errorType: ProcessErrorType.tipVeryHigh, shouldDiscard: true };
    if (/EpochHeightOutOfBound/i.test(errStr)) return { errorType: ProcessErrorType.epochHeightOutOfBound, shouldDiscard: true };
    if (/exceeds the maximum value/i.test(errStr)) return { errorType: ProcessErrorType.gasExceedsLimit, shouldDiscard: true };
    if (/NotEnoughBaseGas/i.test(errStr)) return { errorType: ProcessErrorType.notEnoughBaseGas, shouldDiscard: true };
    // can't find this error in geth
    if (/invalid chainid/i.test(errStr) || /ChainIdMismatch/i.test(errStr)) return { errorType: ProcessErrorType.chainIdMismatch, shouldDiscard: true };

    if (/RlpIncorrectListLen/i.test(errStr) || /RlpExpectedToBeList/i.test(errStr) || /Can not recover pubkey for Ethereum like tx/i.test(errStr))
      return { errorType: ProcessErrorType.signatureError, shouldDiscard: true };

    if (/Request rejected due to still in the catch up mode/i.test(errStr)) return { errorType: ProcessErrorType.nodeInCatchUp, shouldDiscard: true };

    if (/Failed to read account_cache from storage: {}/i.test(errStr)) return { errorType: ProcessErrorType.internalError, shouldDiscard: true };

    if (/Vm reverted./i.test(errStr)) return { errorType: ProcessErrorType.contractExecuteFailed, shouldDiscard: true };

    if (/NotEnoughCash/i.test(errStr)) return { errorType: ProcessErrorType.notEnoughCash, shouldDiscard: true };
  }

  return { errorType: ProcessErrorType.unknownError, shouldDiscard: true };
};
