import { isAddress } from 'cive/utils';
import { validate as isHexAddress } from 'ox/Address';

type TruncateOptions = { prefixLength?: number; suffixLength?: number; ellipsis?: string };

export function truncate(value: string, { prefixLength = 4, suffixLength = 4, ellipsis = '...' }: TruncateOptions = {}) {
  if (value.length <= prefixLength + suffixLength) return value;
  return `${value.substring(0, prefixLength)}${ellipsis}${value.substring(value.length - suffixLength)}`;
}

export function shortenAddress(address?: string | null, options: TruncateOptions = {}) {
  if (!address) return '';
  if (isHexAddress(address, { strict: false })) return `0x${truncate(address.slice(2), options)}`;
  if (isAddress(address)) {
    const network = address.split(':')[0];
    const payload = address.split(':').at(-1)!;
    return `${network}:${truncate(payload, { prefixLength: 3, suffixLength: network.toLowerCase() === 'cfx' ? 8 : 4, ...options })}`.toLowerCase();
  }
  return truncate(address, options);
}
