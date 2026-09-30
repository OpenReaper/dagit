export const registryAbi = [
  {
    type: 'function', name: 'register', stateMutability: 'nonpayable',
    inputs: [{ name: 'digest', type: 'bytes32' }, { name: 'manifestDigest', type: 'bytes32' }], outputs: []
  },
  {
    type: 'function', name: 'proofOf', stateMutability: 'view',
    inputs: [{ name: 'digest', type: 'bytes32' }],
    outputs: [{ name: '', type: 'tuple', components: [
      { name: 'registrant', type: 'address' }, { name: 'registeredAt', type: 'uint64' }, { name: 'manifestDigest', type: 'bytes32' }
    ] }]
  },
  {
    type: 'event', name: 'ProofRegistered', anonymous: false,
    inputs: [
      { indexed: true, name: 'digest', type: 'bytes32' },
      { indexed: true, name: 'registrant', type: 'address' },
      { indexed: true, name: 'manifestDigest', type: 'bytes32' },
      { indexed: false, name: 'schemaVersion', type: 'uint16' }
    ]
  }
] as const;
