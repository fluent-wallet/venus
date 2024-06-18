import { isAddress } from 'ethers';

export function toPlainString(num: string | number) {
  return ('' + +num).replace(/(-?)(\d*)\.?(\d*)e([+-]\d+)/, function (a, b, c, d, e) {
    return e < 0 ? b + '0.' + Array(1 - e - c.length).join(0) + c + d : b + c + d + Array(e - d.length + 1).join(0);
  });
}

export interface ETHURL {
  schema_prefix: string;
  target_address: string;
  chain_id?: string;
  function_name?: string;
  parameters?: { address?: string; value?: string | bigint; uint256?: bigint | bigint; gas?: string; gasLimit?: string; gasPrice?: string };
}

export function bigIntToExponential(value: bigint): string {
  if (typeof value !== 'bigint') throw new Error('Argument must be a bigint, but a ' + typeof value + ' was supplied.');

  //

  const isNegative = value < 0;
  if (isNegative) value = -value; // Using the absolute value for the digits.

  const str = value.toString();

  const exp = str.length - 1;
  if (exp == 0) return (isNegative ? '-' : '') + str + 'e0';

  const mantissaDigits = str.replace(/(0+)$/, ''); // Remove any mathematically insignificant zeroes.

  // Use the single first digit for the integral part of the mantissa, and all following digits for the fractional part (if any).
  let mantissa = mantissaDigits.charAt(0);
  if (mantissaDigits.length > 1) {
    mantissa += '.' + mantissaDigits.substring(1);
  }

  return (isNegative ? '-' : '') + mantissa + 'e' + exp.toString();
}

export const parseETHURL = (ETHURL: string) => {
  if (typeof ETHURL !== 'string') {
    throw new Error('URL must be a string');
  }

  // url must start with ethereum:
  if (!ETHURL.startsWith('ethereum:')) {
    throw new Error('URL is not a valid ethereum URL');
  }

  const addressHexPrefix = ETHURL.substring(9, 11);
  const addressPayPrefix = ETHURL.substring(9, 13);

  const addressRegex = '(0x[\\w]{40})';
  let regexPrefix = '';

  if (addressPayPrefix.toLowerCase() === 'pay-') {
    regexPrefix = addressPayPrefix;
  } else if (addressHexPrefix.toLowerCase() !== '0x') {
    throw new Error('address is invalid');
  }
  const full_regex = '^ethereum:(' + regexPrefix + ')?' + addressRegex + '\\@?([\\w]*)*\\/?([\\w]*)*';
  const exp = new RegExp(full_regex, 'i');

  const data = ETHURL.match(exp);

  if (!data) {
    throw new Error('can not parse the ethereum URL');
  }

  const parameters = ETHURL.split('?').length > 1 ? ETHURL.split('?')[1] : '';

  const target_address = data[2];

  if (!isAddress(target_address)) {
    throw new Error('get target address is error');
  }

  const chain_id = data[3];
  const function_name = data[4];
  const result: ETHURL = {
    schema_prefix: 'ethereum',
    target_address: data[2],
  };

  if (chain_id) {
    result.chain_id = chain_id;
  }

  if (function_name) {
    result.function_name = function_name;
  }
  const params = new URLSearchParams(parameters);

  for (const [key, value] of params.entries()) {
    if (!result.parameters) {
      result.parameters = {};
    }
    if (key === 'value' || key === 'uint256') {
      result.parameters[key] = BigInt(toPlainString(value));
    } else {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      result.parameters[key] = value;
    }
  }
  return result;
};

export const encodeETHURL = (params: ETHURL) => {
  const { parameters, function_name, target_address, chain_id, schema_prefix } = params;
  let query = '';
  const queryString = new URLSearchParams();

  if (parameters) {
    Object.entries(parameters).sort().forEach(([key, value]) => {
      if (key === 'uint256' || key === 'value') {
        queryString.set(key, bigIntToExponential(BigInt(value)));
      } else {
        queryString.set(key, value.toString());
      }
    });
    query = queryString.toString();
  }
  return `${schema_prefix}:${target_address}${chain_id ? `@${chain_id}` : ''}${function_name ? `/${function_name}` : ''}${query ? `?${query}` : ''}`;
};
