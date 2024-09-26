const WalletConfig = [
  { inputs: [{ internalType: 'string[]', name: 'keys', type: 'string[]' }], name: 'batchRemove', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  {
    inputs: [
      { internalType: 'string[]', name: 'keys', type: 'string[]' },
      { internalType: 'string[]', name: 'values', type: 'string[]' },
    ],
    name: 'batchSet',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'key', type: 'string' }],
    name: 'contains',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'string', name: 'key', type: 'string' }],
    name: 'get',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'offset', type: 'uint256' },
      { internalType: 'uint256', name: 'limit', type: 'uint256' },
    ],
    name: 'list',
    outputs: [
      { internalType: 'uint256', name: 'total', type: 'uint256' },
      {
        components: [
          { internalType: 'string', name: 'key', type: 'string' },
          { internalType: 'string', name: 'value', type: 'string' },
        ],
        internalType: 'struct Config.Pair[]',
        name: 'pairs',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  { inputs: [{ internalType: 'string', name: 'key', type: 'string' }], name: 'remove', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  {
    inputs: [
      { internalType: 'string', name: 'key', type: 'string' },
      { internalType: 'string', name: 'value', type: 'string' },
    ],
    name: 'set',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export default WalletConfig;
