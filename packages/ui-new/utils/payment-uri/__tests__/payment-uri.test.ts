import { NetworkType } from '@core/utils/consts';
import { maxUint256 } from '@core/utils/number';
import { encodePaymentUri, type PaymentRequest, parsePaymentUri } from '../index';

const recipient = '0x1111111111111111111111111111111111111111';
const token = '0x2222222222222222222222222222222222222222';
const coreRecipient = 'cfx:aajaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0u8nbgtn';
const coreToken = 'cfx:acaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaae54pwdts6';

describe('payment URIs', () => {
  test('writes native eSpace payments with a decimal chain ID and an exact atomic amount', () => {
    const payment: PaymentRequest = {
      networkType: NetworkType.Ethereum,
      chainId: 1030n,
      recipientAddress: recipient,
      asset: { type: 'native' },
      amountBaseUnits: 10n ** 18n,
    };
    const uri = encodePaymentUri(payment);
    expect(uri).toBe(`ethereum:${recipient}@1030?value=1000000000000000000`);
    expect(parsePaymentUri(uri)).toEqual(payment);
  });

  test('uses the contract as the ERC20 target and preserves the recipient and exact scientific amount', () => {
    const payment: PaymentRequest = {
      networkType: NetworkType.Ethereum,
      chainId: 1030n,
      recipientAddress: recipient,
      asset: { type: 'erc20', contractAddress: token },
      amountBaseUnits: 1234567890123456789000n,
    };
    const uri = encodePaymentUri(payment);
    expect(uri).toBe(`ethereum:${token}@1030/transfer?address=${recipient}&uint256=1234567890123456789000`);
    expect(parsePaymentUri(uri)).toEqual(payment);
    expect(parsePaymentUri(`ethereum:${token}@1030/transfer?address=${recipient}&uint256=1.234567890123456789e+21`)).toEqual(payment);
  });

  test('reads and writes standard ERC20 requests without an amount, including the optional pay prefix', () => {
    const payment: PaymentRequest = { networkType: NetworkType.Ethereum, recipientAddress: recipient, asset: { type: 'erc20', contractAddress: token } };
    expect(encodePaymentUri(payment)).toBe(`ethereum:${token}/transfer?address=${recipient}`);
    expect(parsePaymentUri(encodePaymentUri(payment))).toEqual(payment);
    expect(parsePaymentUri(`ethereum:pay-${token}/transfer?address=${recipient}`)).toEqual(payment);
  });

  test('accepts legacy hex chain IDs and preserves identities larger than a JavaScript number can represent', () => {
    const payment = parsePaymentUri(`ethereum:${recipient}@0x406`);
    expect(payment).toMatchObject({ networkType: NetworkType.Ethereum, chainId: 1030n });
    expect(encodePaymentUri(payment)).toBe(`ethereum:${recipient}@1030`);
    expect(parsePaymentUri(`ethereum:${recipient}@9007199254740993`)).toEqual(parsePaymentUri(`ethereum:${recipient}@0x20000000000001`));
    expect(parsePaymentUri(`ethereum:${recipient}@9007199254740993`)).toMatchObject({ chainId: 9007199254740993n });
  });

  test('derives Core network identity from the address and retains existing Core amount formats', () => {
    const payment: PaymentRequest = {
      networkType: NetworkType.Conflux,
      chainId: 1029n,
      recipientAddress: coreRecipient,
      asset: { type: 'native' },
      amountBaseUnits: 2n,
    };
    expect(encodePaymentUri(payment)).toBe(`${coreRecipient}?value=2`);
    expect(() => encodePaymentUri({ ...payment, chainId: 1n })).toThrow();
    expect(parsePaymentUri(`${coreRecipient}?value=0x2`)).toEqual(payment);
    expect(parsePaymentUri('cfxtest:aajaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa65r5hpnb?value=2e0&gas=21000')).toEqual({
      ...payment,
      chainId: 1n,
      recipientAddress: 'cfxtest:aajaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa65r5hpnb',
    });
  });

  test('preserves the Core token wire format while exposing explicit recipient and asset fields', () => {
    const payment: PaymentRequest = {
      networkType: NetworkType.Conflux,
      chainId: 1029n,
      recipientAddress: coreRecipient,
      asset: { type: 'erc20', contractAddress: coreToken },
      amountBaseUnits: 7n,
    };
    const uri = encodePaymentUri(payment);
    expect(uri).toBe(`${coreRecipient}/transfer?address=${encodeURIComponent(coreToken)}&value=7`);
    expect(parsePaymentUri(uri)).toEqual(payment);
  });

  test('preserves literal and escaped plus signs in payment amounts', () => {
    for (const amount of ['+1', '%2B1', '.1e+1', '1e%2B0']) {
      expect(parsePaymentUri(`ethereum:${recipient}?value=${amount}`).amountBaseUnits).toBe(1n);
    }
  });

  test('rejects unsupported or ambiguous payment requests', () => {
    const invalidUris = [
      `conflux:${recipient}`,
      `ethereum:${token}/approve?address=${recipient}&uint256=1`,
      `ethereum:${recipient}/transfer?address=${token}&value=1e18`,
      `ethereum:${token}/transfer?address=${recipient}&address=${token}&uint256=1`,
      `ethereum:${recipient}@1030invalid`,
    ];
    for (const uri of invalidUris) expect(() => parsePaymentUri(uri)).toThrow();
  });

  test('rejects invalid decimal syntax and fractional atomic amounts', () => {
    for (const amount of ['0x10', '1_000', '1.5', '']) {
      expect(() => parsePaymentUri(`ethereum:${recipient}?value=${amount}`)).toThrow();
    }
  });

  test('preserves the maximum uint256 amount and rejects amounts outside its range', () => {
    const payment: PaymentRequest = { networkType: NetworkType.Ethereum, recipientAddress: recipient, asset: { type: 'native' }, amountBaseUnits: maxUint256 };
    expect(parsePaymentUri(encodePaymentUri(payment))).toEqual(payment);
    for (const amountBaseUnits of [-1n, maxUint256 + 1n]) {
      expect(() => encodePaymentUri({ ...payment, amountBaseUnits })).toThrow();
      expect(() => parsePaymentUri(`ethereum:${recipient}?value=${amountBaseUnits}`)).toThrow();
    }
  });
});
