import { __resetPaymentUriRegistryForTests, encodePaymentUri, parsePaymentUri, registerCodec } from '@utils/payment-uri';
import { ethereumPaymentUriCodec } from '@utils/payment-uri/codecs/ethereum';

beforeEach(() => {
  __resetPaymentUriRegistryForTests();
  registerCodec(ethereumPaymentUriCodec);
});

describe('Ethereum payment URI codec', () => {
  test('parse simple address', () => {
    const result = parsePaymentUri('ethereum:0x0000000000000000000000000000000000000000');
    expect(result).toMatchObject({
      protocol: 'ethereum',
      address: '0x0000000000000000000000000000000000000000',
      metadata: { codecId: 'ethereum' },
    });
  });

  test('parse pay- prefixed address', () => {
    const result = parsePaymentUri('ethereum:pay-0x0000000000000000000000000000000000000000');
    expect(result).toMatchObject({
      protocol: 'ethereum',
      address: '0x0000000000000000000000000000000000000000',
    });
  });

  test('parse with chain, method and params', () => {
    const result = parsePaymentUri(
      'ethereum:0x0000000000000000000000000000000000000000@0x405/transfer?address=0x0000000000000000000000000000000000000000&uint256=1e0',
    );
    expect(result).toMatchObject({
      protocol: 'ethereum',
      address: '0x0000000000000000000000000000000000000000',
      network: { chainId: '0x405' },
      method: 'transfer',
      params: {
        address: '0x0000000000000000000000000000000000000000',
        uint256: BigInt(1),
      },
    });
  });

  test('encode round-trip', () => {
    const uri = encodePaymentUri({
      protocol: 'ethereum',
      address: '0x0000000000000000000000000000000000000000',
      network: { chainId: '0x405' },
      method: 'transfer',
      params: {
        uint256: BigInt(1),
        address: '0x0000000000000000000000000000000000000000',
      },
    });

    expect(uri).toBe('ethereum:0x0000000000000000000000000000000000000000@0x405/transfer?address=0x0000000000000000000000000000000000000000&uint256=1e0');

    const parsed = parsePaymentUri(uri);
    expect(parsed).toMatchObject({
      protocol: 'ethereum',
      address: '0x0000000000000000000000000000000000000000',
      network: { chainId: '0x405' },
      method: 'transfer',
    });
  });
});
