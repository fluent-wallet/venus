import { CoreError } from '@core/errors';
import { HttpJsonRpcClient } from '@core/rpc';
import { ProcessErrorType, processError } from '../eth';

describe('transaction error classification through the RPC client', () => {
  it.each([
    [{ code: -32000, message: 'already known' }, ProcessErrorType.duplicateTx],
    [{ code: -32602, message: 'Invalid parameters: tx', data: 'is discarded due to out of balance' }, ProcessErrorType.balanceNotEnough],
    [{ code: -32000, message: 'nonce too low' }, ProcessErrorType.tooStaleNonce],
  ])('classifies %j while retaining the RPC error context', async (rpcError, errorType) => {
    const fetchFn = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, error: rpcError }) });
    const error = await new HttpJsonRpcClient('https://rpc.example', { fetchFn }).request('eth_sendRawTransaction', ['0xraw']).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(CoreError);
    expect((error as CoreError).context?.rpcError).toMatchObject(rpcError);
    expect(processError(error).errorType).toBe(errorType);
  });
});
