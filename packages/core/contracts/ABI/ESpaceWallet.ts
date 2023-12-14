const ESpaceWallet = [
  { anonymous: false, inputs: [{ indexed: false, internalType: 'uint8', name: 'version', type: 'uint8' }], name: 'Initialized', type: 'event' },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'address', name: 'token', type: 'address' },
    ],
    name: 'assetOf',
    outputs: [
      {
        components: [
          {
            components: [
              { internalType: 'address', name: 'token', type: 'address' },
              { internalType: 'string', name: 'name', type: 'string' },
              { internalType: 'string', name: 'symbol', type: 'string' },
              { internalType: 'uint8', name: 'decimals', type: 'uint8' },
            ],
            internalType: 'struct Token.TokenInfo',
            name: 'token',
            type: 'tuple',
          },
          { internalType: 'uint256', name: 'balance', type: 'uint256' },
        ],
        internalType: 'struct IWallet.AssetInfo',
        name: 'info',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'uint256', name: 'erc', type: 'uint256' },
      { internalType: 'uint256', name: 'offset', type: 'uint256' },
      { internalType: 'uint256', name: 'limit', type: 'uint256' },
    ],
    name: 'assets',
    outputs: [
      { internalType: 'uint256', name: 'total', type: 'uint256' },
      {
        components: [
          {
            components: [
              { internalType: 'address', name: 'token', type: 'address' },
              { internalType: 'string', name: 'name', type: 'string' },
              { internalType: 'string', name: 'symbol', type: 'string' },
              { internalType: 'uint8', name: 'decimals', type: 'uint8' },
            ],
            internalType: 'struct Token.TokenInfo',
            name: 'token',
            type: 'tuple',
          },
          { internalType: 'uint256', name: 'balance', type: 'uint256' },
        ],
        internalType: 'struct IWallet.AssetInfo[]',
        name: 'tokens',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'address[]', name: 'tokens', type: 'address[]' },
    ],
    name: 'assetsOf',
    outputs: [
      {
        components: [
          {
            components: [
              { internalType: 'address', name: 'token', type: 'address' },
              { internalType: 'string', name: 'name', type: 'string' },
              { internalType: 'string', name: 'symbol', type: 'string' },
              { internalType: 'uint8', name: 'decimals', type: 'uint8' },
            ],
            internalType: 'struct Token.TokenInfo',
            name: 'token',
            type: 'tuple',
          },
          { internalType: 'uint256', name: 'balance', type: 'uint256' },
        ],
        internalType: 'struct IWallet.AssetInfo[]',
        name: 'list',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'address', name: 'token', type: 'address' },
      { internalType: 'bool', name: 'suppressError', type: 'bool' },
    ],
    name: 'getBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'address', name: 'token', type: 'address' },
    ],
    name: 'getBalance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'address[]', name: 'tokens', type: 'address[]' },
    ],
    name: 'getBalances',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address[]', name: 'accounts', type: 'address[]' },
      { internalType: 'address', name: 'token', type: 'address' },
    ],
    name: 'getBalances',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address[]', name: 'accounts', type: 'address[]' },
      { internalType: 'address[]', name: 'tokens', type: 'address[]' },
    ],
    name: 'getBalances',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'contract ITokenList', name: 'tokenList_', type: 'address' }],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  { inputs: [], name: 'tokenList', outputs: [{ internalType: 'contract ITokenList', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
] as const;

export default ESpaceWallet;
