import { type ISignatureRecord, SignatureFilterOption, SignType } from '@core/services/signing/types';
import type { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { useCurrentAddress } from './account';
import { getSignatureRecordService } from './core';
import { createTestQueryClient, createWrapper } from './mocks/reactQuery';
import {
  getSignatureRecordsCountKey,
  getSignatureRecordsKey,
  useSignatureRecordsCountOfAddress,
  useSignatureRecordsCountOfCurrentAddress,
  useSignatureRecordsOfAddress,
  useSignatureRecordsOfCurrentAddress,
} from './signature';

jest.mock('./core', () => ({ getSignatureRecordService: jest.fn() }));
jest.mock('./account', () => ({ useCurrentAddress: jest.fn() }));

type SignatureRecordServiceMock = {
  listRecords: jest.Mock;
  countRecords: jest.Mock;
};

describe('signature service hooks', () => {
  let queryClient: QueryClient;
  let wrapper: React.ComponentType<{ children: React.ReactNode }>;
  let service: SignatureRecordServiceMock;

  const mockRecord: ISignatureRecord = {
    id: 'sig_1',
    addressId: 'addr_1',
    appId: null,
    txId: null,
    signType: SignType.STR,
    message: '0xdeadbeef',
    blockNumber: '0x10',
    createdAt: 1_700_000_000_000,
  };

  beforeEach(() => {
    queryClient = createTestQueryClient();
    wrapper = createWrapper(queryClient);
    service = {
      listRecords: jest.fn(),
      countRecords: jest.fn(),
    };
    (getSignatureRecordService as jest.Mock).mockReturnValue(service);
    (useCurrentAddress as jest.Mock).mockReturnValue({ data: { id: 'addr_1', value: '0xabc' }, isSuccess: true });
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  it('useSignatureRecordsOfAddress caches by records key', async () => {
    service.listRecords.mockResolvedValue([mockRecord]);

    const { result } = renderHook(() => useSignatureRecordsOfAddress('addr_1', { filter: SignatureFilterOption.All, limit: 20, offset: 0 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.listRecords).toHaveBeenCalledWith({ addressId: 'addr_1', filter: SignatureFilterOption.All, limit: 20, offset: 0 });
    expect(queryClient.getQueryData(getSignatureRecordsKey('addr_1', SignatureFilterOption.All, 20, 0))).toEqual([mockRecord]);
  });

  it('useSignatureRecordsCountOfAddress caches by count key', async () => {
    service.countRecords.mockResolvedValue(12);

    const { result } = renderHook(() => useSignatureRecordsCountOfAddress('addr_1', SignatureFilterOption.Message), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.countRecords).toHaveBeenCalledWith({ addressId: 'addr_1', filter: SignatureFilterOption.Message });
    expect(queryClient.getQueryData(getSignatureRecordsCountKey('addr_1', SignatureFilterOption.Message))).toBe(12);
  });

  it('useSignatureRecordsOfCurrentAddress derives addressId from useCurrentAddress()', async () => {
    service.listRecords.mockResolvedValue([mockRecord]);

    const { result } = renderHook(() => useSignatureRecordsOfCurrentAddress({ filter: SignatureFilterOption.All }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.listRecords).toHaveBeenCalledWith({ addressId: 'addr_1', filter: SignatureFilterOption.All, limit: undefined, offset: undefined });
  });

  it('useSignatureRecordsCountOfCurrentAddress derives addressId from useCurrentAddress()', async () => {
    service.countRecords.mockResolvedValue(1);

    const { result } = renderHook(() => useSignatureRecordsCountOfCurrentAddress(SignatureFilterOption.All), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(service.countRecords).toHaveBeenCalledWith({ addressId: 'addr_1', filter: SignatureFilterOption.All });
  });

  it('disables current-address hooks when no current address', async () => {
    (useCurrentAddress as jest.Mock).mockReturnValue({ data: null });

    const recordsHook = renderHook(() => useSignatureRecordsOfCurrentAddress({ filter: SignatureFilterOption.All }), { wrapper });
    const countHook = renderHook(() => useSignatureRecordsCountOfCurrentAddress(SignatureFilterOption.All), { wrapper });

    await waitFor(() => expect(recordsHook.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(countHook.result.current.isSuccess).toBe(true));

    expect(service.listRecords).not.toHaveBeenCalled();
    expect(service.countRecords).not.toHaveBeenCalled();

    expect(recordsHook.result.current.data).toEqual([]);
    expect(countHook.result.current.data).toBe(0);
  });
});
