import { encodeETHURL, parseETHURL, toPlainString } from '@utils/ETHURL';

describe('ETHURL', () => {
  test('parse address without', () => {
    const result = parseETHURL('ethereum:0x0000000000000000000000000000000000000000');
    expect(result).toMatchObject({ schema_prefix: 'ethereum', target_address: '0x0000000000000000000000000000000000000000' });
  });

  test('parse address with pay- prefix ', () => {
    const result = parseETHURL('ethereum:pay-0x0000000000000000000000000000000000000000');
    expect(result).toMatchObject({ schema_prefix: 'ethereum', target_address: '0x0000000000000000000000000000000000000000' });
  });

  test('parse address with zzz- prefix ', () => {
    const result = parseETHURL('ethereum:zzz-0x0000000000000000000000000000000000000000');
    expect(result).toMatchObject({ error: 'address is invalid' });
  });

  test('parse address with ', () => {
    const result = parseETHURL(
      'ethereum:0x0000000000000000000000000000000000000000@0x405/transfer?address=0x0000000000000000000000000000000000000000&uint256=1'
    );
    expect(result).toMatchObject({
      schema_prefix: 'ethereum',
      target_address: '0x0000000000000000000000000000000000000000',
      chain_id: '0x405',
      function_name: 'transfer',
      parameters: {
        address: '0x0000000000000000000000000000000000000000',
        uint256: BigInt(1),
      },
    });
  });

  test('parse value gas gaslimit', () => {
    const result = parseETHURL('ethereum:0x0000000000000000000000000000000000000000@0x405?value=10.234e18&gas=2000&gasLimit=21111');
    expect(result).toMatchObject({
      schema_prefix: 'ethereum',
      target_address: '0x0000000000000000000000000000000000000000',
      chain_id: '0x405',
      parameters: {
        value: BigInt('10234000000000000000'),
        gas: '2000',
        gasLimit: '21111',
      },
    });
  });

  test('encode address', () => {
    const result = encodeETHURL({ schema_prefix: 'ethereum', target_address: '0x0000000000000000000000000000000000000000' });
    expect(result).toBe('ethereum:0x0000000000000000000000000000000000000000');
  });

  test('encode with value gas gasLimit', () => {
    const result = encodeETHURL({
      schema_prefix: 'ethereum',
      target_address: '0x0000000000000000000000000000000000000000',
      chain_id: '0x405',
      function_name: 'transfer',
      parameters: {
        uint256: BigInt(1),
        address: '0x0000000000000000000000000000000000000000',
      },
    });

    expect(result).toBe('ethereum:0x0000000000000000000000000000000000000000@0x405/transfer?address=0x0000000000000000000000000000000000000000&uint256=1');
  });
});

describe('toPlainString', () => {
  test('positive exponential strings', () => {
    expect(toPlainString('0.123e-1')).toEqual('0.0123');
    expect(toPlainString('1.123e-1')).toEqual('0.1123');
    expect(toPlainString('1.123e-5')).toEqual('0.00001123');
    expect(toPlainString('12.123e-1')).toEqual('1.2123');
    expect(toPlainString('12.123e-5')).toEqual('0.00012123');
    expect(toPlainString('123.123e-1')).toEqual('12.3123');
    expect(toPlainString('123.123e-5')).toEqual('0.00123123');
    expect(toPlainString('123.123e+4')).toEqual('1231230');
    expect(toPlainString('123.123e+2')).toEqual('12312.3');
    expect(toPlainString('123.123e+0')).toEqual('123.123');
  });
  test('negative exponential strings', () => {
    expect(toPlainString('-0.123e-1')).toEqual('-0.0123');
    expect(toPlainString('-1.123e-1')).toEqual('-0.1123');
    expect(toPlainString('-1.123e-5')).toEqual('-0.00001123');
    expect(toPlainString('-12.123e-1')).toEqual('-1.2123');
    expect(toPlainString('-12.123e-5')).toEqual('-0.00012123');
    expect(toPlainString('-123.123e-1')).toEqual('-12.3123');
    expect(toPlainString('-123.123e-5')).toEqual('-0.00123123');
    expect(toPlainString('-123.123e+4')).toEqual('-1231230');
    expect(toPlainString('-123.123e+2')).toEqual('-12312.3');
    expect(toPlainString('-123.123e+0')).toEqual('-123.123');
  });
  test('not exponential', () => {
    expect(toPlainString(0)).toEqual('0');
    expect(toPlainString(0.0012)).toEqual('0.0012');
    expect(toPlainString(123)).toEqual('123');
    expect(toPlainString(123e14)).toEqual('12300000000000000'); 
    expect(toPlainString(0.123e-4)).toEqual('0.0000123');
  });
});
