# add bsim arr dependencies

add this to your build.gradle

```
implementation files('../../node_modules/react-native-bsim/android/libs/bsimlib.aar')
implementation files('../../node_modules/react-native-bsim/android/libs/omachannel.aar')

```

# sign transaction

```ts
const wallet = new JsonRpcSigner(provider, coinType.address);

const txPopulate = await wallet.populateTransaction({
  to: coinType.address,
  value: 0,
  data: '0x',
  type: 0,
  //   chainId: .., // your chain id
});

const tx = new Transaction();
for (const key in txPopulate) {
  tx[key as 'to'] = txPopulate[key as 'to'];
}
// sign tx hash
const { r, s, v } = await signMessage({
  messageHash: tx.unsignedHash,
  coinType: coinType.coinType,
  coinTypeIndex: coinType.index,
});
const sign = Signature.from({ r, s, v });

// verify sign
const parseResult = Transaction.from(tx);
const verify = await wallet.verify(parseResult, sign);
// recoverPublicKey
console.log(parseResult.fromPublicKey);
```
