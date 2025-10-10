import { buildExportPubkey, buildSignMessage, buildVerifyBpin, serializeCommand } from './params';
import { ApduFlowError, exportPubkeysFlow, signMessageFlow, verifyBpinFlow } from './workflows';

const DER_SIGNATURE =
  '3045022100F3949D7B92917A23C54D76FAA6DDD4D41E25385443F078DAC3F88FC5BE6FD7F002205550E2C1A28FDB1A698E6AD1F1B12D3093387DA71903C0CC1AA7DC21D2997D0D';

const PUBKEY_SEGMENT_1 = `C2470000003C020140${'EE'.repeat(32)}`;
const PUBKEY_SEGMENT_2 = 'EE'.repeat(32);

type ScriptStep = { command: string; response: string };

const createTransmit = (script: ScriptStep[]) => {
  let step = 0;
  return async (payload: string) => {
    const current = script[step];
    if (!current || current.command !== payload) {
      throw new Error(`Unexpected APDU payload: ${payload}`);
    }
    step += 1;
    return current.response;
  };
};

describe('core workflows', () => {
  it('verifies BPIN successfully', async () => {
    const transmit = createTransmit([{ command: serializeCommand(buildVerifyBpin()), response: '9000' }]);

    await expect(verifyBpinFlow(transmit)).resolves.toBeUndefined();
  });

  it('throws when BPIN verification fails', async () => {
    const transmit = createTransmit([{ command: serializeCommand(buildVerifyBpin()), response: '6A88' }]);

    await expect(verifyBpinFlow(transmit)).rejects.toBeInstanceOf(ApduFlowError);
  });

  it('signs message and returns r/s components', async () => {
    const hash = 'A1'.repeat(32);
    const transmit = createTransmit([{ command: serializeCommand(buildSignMessage(hash, 0x3c, 0x02)), response: `${DER_SIGNATURE}9000` }]);

    await expect(signMessageFlow(transmit, hash, 0x3c, 0x02)).resolves.toEqual({
      r: 'F3949D7B92917A23C54D76FAA6DDD4D41E25385443F078DAC3F88FC5BE6FD7F0',
      s: '5550E2C1A28FDB1A698E6AD1F1B12D3093387DA71903C0CC1AA7DC21D2997D0D',
    });
  });

  it('aggregates pubkey segments until success', async () => {
    const transmit = createTransmit([
      { command: serializeCommand(buildExportPubkey(false)), response: `${PUBKEY_SEGMENT_1}6300` },
      { command: serializeCommand(buildExportPubkey(true)), response: `${PUBKEY_SEGMENT_2}9000` },
    ]);

    const result = await exportPubkeysFlow(transmit);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      coinType: 0x3c,
      index: 0x02,
      alg: 0x01,
      key: 'EE'.repeat(64),
    });
  });
});
