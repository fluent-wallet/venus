import { isAddress } from 'ethers';

export function toPlainString(num: string) {
  return ('' + +num).replace(/(-?)(\d*)\.?(\d*)e([+-]\d+)/, function (a, b, c, d, e) {
    return e < 0 ? b + '0.' + Array(1 - e - c.length).join(0) + c + d : b + c + d + Array(e - d.length + 1).join(0);
  });
}

export interface ETHURL {
  schema_prefix: string;
  target_address: string;
  chain_id?: string;
  function_name?: string;
  parameters?: Record<string, string | number | bigint> & { value?: bigint; uint256?: bigint };
}
export const parseETHURL = (ETHURL: string): ETHURL | { error: string } => {
  if (typeof ETHURL !== 'string') {
    return { error: 'URL must be a string' };
  }

  // url must start with ethereum:
  if (!ETHURL.startsWith('ethereum:')) {
    return { error: 'URL is not a valid ethereum URL' };
  }

  const addressHexPrefix = ETHURL.substring(9, 11);
  const addressPayPrefix = ETHURL.substring(9, 13);

  const addressRegex = '(0x[\\w]{40})';
  let regexPrefix = '';

  if (addressPayPrefix.toLowerCase() === 'pay-') {
    regexPrefix = addressPayPrefix;
  } else if (addressHexPrefix.toLowerCase() !== '0x') {
    return { error: 'address is invalid' };
  }
  const full_regex = '^ethereum:(' + regexPrefix + ')?' + addressRegex + '\\@?([\\w]*)*\\/?([\\w]*)*';
  const exp = new RegExp(full_regex, 'i');

  const data = ETHURL.match(exp);

  if (!data) {
    return { error: 'can not parse the ethereum URL' };
  }

  const parameters = ETHURL.split('?').length > 1 ? ETHURL.split('?')[1] : '';

  const target_address = data[2];

  if (!isAddress(target_address)) {
    return { error: 'get target address is error' };
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

  params.forEach((value, key) => {
    if (!result.parameters) {
      result.parameters = {};
    }
    if (value && key) {
      if (result.parameters) {
        if (key === 'value' || key === 'uint256') {
          result.parameters[key] = BigInt(toPlainString(value));
        } else {
          result.parameters[key] = value;
        }
      }
    }
  });
  return result;
};

export const encodeETHURL = (params: ETHURL) => {
  const { parameters, function_name, target_address, chain_id } = params;
  let query = '';
  const queryString: Record<string, string> = {};

  if (parameters) {
    Object.keys(parameters).forEach((key) => {
      if (key === 'uint256' && function_name && function_name === 'transfer' && parameters.uint256) {
        queryString.uint256 = parameters.uint256.toString();
      } else if (key === 'value' && parameters.value) {
        queryString.value = parameters.value.toString();
      } else {
        queryString[key] = `${parameters[key]}`;
      }
    });

    const qs = new URLSearchParams(queryString);
    qs.sort();
    query = qs.toString();
  }
  return `ethereum:${target_address}${chain_id ? `@${chain_id}` : ''}${function_name ? `/${function_name}` : ''}${query ? `?${query}` : ''}`;
};
