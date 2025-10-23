import { registerCodec, parsePaymentUri, encodePaymentUri, __resetPaymentUriRegistryForTests } from '@utils/payment-uri';
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
});
