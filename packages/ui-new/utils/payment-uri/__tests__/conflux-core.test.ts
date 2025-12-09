import { __resetPaymentUriRegistryForTests, encodePaymentUri, PaymentUriError, parsePaymentUri, registerCodec } from '@utils/payment-uri';
import { confluxCorePaymentUriCodec } from '@utils/payment-uri/codecs/conflux-core';

const base32Mainnet = 'cfx:aajaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0u8nbgtn';
const base32Testnet = 'cfxtest:aajaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa65r5hpnb';

beforeEach(() => {
  __resetPaymentUriRegistryForTests();
  registerCodec(confluxCorePaymentUriCodec);
});

describe('Conflux Core payment URI codec', () => {
  test('parse mainnet URI', () => {
    const uri = `${base32Mainnet}?value=1e18&gas=21000&storageLimit=10000`;
    const result = parsePaymentUri(uri);

    expect(result).toMatchObject({
      protocol: 'conflux',
      address: base32Mainnet,
      network: { netId: '1029', namespace: 'cfx' },
      params: {
        value: BigInt('1000000000000000000'),
        gas: '21000',
        storageLimit: '10000',
      },
    });
  });

  test('parse testnet URI', () => {
    const uri = `${base32Testnet}?value=2e0`;
    const result = parsePaymentUri(uri);

    expect(result).toMatchObject({
      protocol: 'conflux',
      address: base32Testnet,
      network: { netId: '1', namespace: 'cfxtest' },
      params: { value: BigInt(2) },
    });
  });

  test('encode round-trip', () => {
    const payload = {
      protocol: 'conflux',
      address: base32Mainnet,
      params: { value: BigInt(3), gas: '21000' },
    };

    const uri = encodePaymentUri(payload);
    expect(uri).toBe(`${base32Mainnet}?gas=21000&value=3e0`);

    const parsed = parsePaymentUri(uri);
    expect(parsed).toMatchObject({
      protocol: 'conflux',
      address: base32Mainnet,
      params: { value: BigInt(3), gas: '21000' },
    });
  });

  test('parse URI with method and uint256', () => {
    const value = BigInt(5);
    const uri = `${base32Mainnet}/transfer?uint256=5e0&address=cfxtest:aajaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa65r5hpnb`;
    const parsed = parsePaymentUri(uri);

    expect(parsed).toMatchObject({
      protocol: 'conflux',
      address: base32Mainnet,
      method: 'transfer',
      params: {
        uint256: value,
        address: 'cfxtest:aajaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa65r5hpnb',
      },
    });
  });

  test('encode preserves method and bigint params', () => {
    const payload = {
      protocol: 'conflux',
      address: base32Mainnet,
      method: 'transfer',
      params: {
        uint256: BigInt('12345678901234567890'),
        gas: '21000',
      },
    };

    const uri = encodePaymentUri(payload);
    expect(uri).toContain('/transfer');

    const parsed = parsePaymentUri(uri);
    expect(parsed.params?.uint256).toEqual(BigInt('12345678901234567890'));
  });

  test('rejects invalid Conflux address', () => {
    expect(() => parsePaymentUri('cfx:invalid')).toThrow(PaymentUriError);
  });

  test('handles large value amounts', () => {
    const largeValue = BigInt('999999999999999999999999');
    const uri = encodePaymentUri({
      protocol: 'conflux',
      address: base32Mainnet,
      params: { value: largeValue },
    });

    const parsed = parsePaymentUri(uri);
    expect(parsed.params?.value).toBe(largeValue);
  });
});
