export type ESpaceChainConfig = {
  walletContract: string;
  tokenListContract: string;
  scanOpenApiBaseUrl: string;
};

const E_SPACE_CONFIG_BY_CHAIN_ID: Record<string, ESpaceChainConfig> = {
  '0x406': {
    walletContract: '0x2c7e015328f37f00f9b16e4adc9cedb1f8742069',
    tokenListContract: '0xf1a8b97ef61bf8fe3c54c94a16c57c0f7afc2277',
    scanOpenApiBaseUrl: 'https://evmapi.confluxscan.org',
  },
  '0x47': {
    walletContract: '0xce2104aa7233b27b0ba2e98ede59b6f78c06ae05',
    tokenListContract: '0xcd54f022b0355e00db610f6b3411c76b5c61320f',
    scanOpenApiBaseUrl: 'https://evmapi-testnet.confluxscan.org',
  },
};

export function getESpaceChainConfig(chainId: string): ESpaceChainConfig | null {
  return E_SPACE_CONFIG_BY_CHAIN_ID[chainId.toLowerCase()] ?? null;
}
