import type { ChainType } from '@core/types';
import { useCallback } from 'react';
import { getAddressValidationService } from './core';

export function isValidAddress(params: { networkType: ChainType; addressValue: string }): boolean {
  return getAddressValidationService().isValidAddress(params);
}

export async function isContractAddress(params: { networkType: ChainType; chainId: string; addressValue: string }): Promise<boolean> {
  return getAddressValidationService().isContractAddress(params);
}

export function useIsContractAddress() {
  return useCallback((params: { networkType: ChainType; chainId: string; addressValue: string }) => isContractAddress(params), []);
}
