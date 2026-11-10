import { Networks } from '@core/utils/consts';
import type { INetwork } from '@service/core';
import { type PaymentInputContext, parseRecipientInput } from './paymentInput';

const recipient = '0x1111111111111111111111111111111111111111';
const token = '0x2222222222222222222222222222222222222222';
const espace: INetwork = { ...Networks['Conflux eSpace'], id: 'espace', endpointsList: [] };
const core: INetwork = { ...Networks['Conflux Mainnet'], id: 'core', endpointsList: [] };
const t = ((key: string) => key) as PaymentInputContext['t'];

test('compares decimal and hex chain IDs by value and extracts the ERC20 recipient', () => {
  for (const chainId of ['1030', '0x406']) {
    expect(parseRecipientInput(`ethereum:${token}@${chainId}/transfer?address=${recipient}`, { currentNetwork: espace, t })).toEqual({
      ok: true,
      data: recipient,
    });
  }
  expect(parseRecipientInput(`ethereum:${recipient}@71`, { currentNetwork: espace, t })).toEqual({ ok: false, message: 'scan.parse.error.missChianId' });
});

test('validates the Core network even when the scanned text is a bare address', () => {
  const address = 'cfx:aajaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0u8nbgtn';
  expect(parseRecipientInput(address, { currentNetwork: core, t })).toEqual({ ok: true, data: address });
  expect(parseRecipientInput('cfxtest:aajaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa65r5hpnb', { currentNetwork: core, t })).toEqual({
    ok: false,
    message: 'scan.parse.error.missChianId',
  });
});
