# BSIM Module

BSIM hardware wallet support for BIM Wallet, with Android APDU and cross-platform Bluetooth LE transports. Android uses APDU by default; iOS uses BLE.

## Usage

```ts
import { createWallet } from 'react-native-bsim';

const wallet = createWallet();
const version = await wallet.getVersion();
const publicKeys = await wallet.exportPubkeys();
```

Transport selection, logging, and the idle timeout can be configured through `createWallet` options. See [wallet.ts](src/wallet.ts) for the API and types.

The Android native module requires an Expo development build or standalone build. Expo Go is not supported.
