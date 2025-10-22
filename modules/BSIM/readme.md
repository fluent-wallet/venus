# BSIM Module

`modules/BSIM` provides cross-platform access to the BSIM hardware card for the Venus wallet. After phase 5:

- **Business logic** (APDU building, response parsing, error handling) now lives in TypeScript.
- **Transports** use a unified `Transport` abstraction for Android APDU and cross-platform BLE.
- **Native code** keeps only the APDU bridge methods: `openApduChannel`, `transmitApdu`, `closeApduChannel`.

  ## Structure

  modules/BSIM
  ├── android/ # React Native Android module (APDU bridge only)
  ├── ios/ # iOS bridge sample for future BLE work
  ├── src/
  │ ├── core/ # APDU builders, parsers, workflows
  │ ├── transports/ # APDU / BLE transport implementations
  │ ├── wallet.ts # Public wallet API
  │ ├── index.ts # Entry point exports
  │ └── ... # Error types, utils, tests, etc.
  ├── package.json
  └── readme.md

# add bsim aar dependencies

add this to your build.gradle

```
implementation files('../../node_modules/react-native-bsim/android/libs/bsimlib.aar')
implementation files('../../node_modules/react-native-bsim/android/libs/omachannel.aar')

```

## Core API

```ts
import { createWallet } from 'react-native-bsim';

const wallet = createWallet({
  transports: [{ kind: 'apdu', options: { autoSelectAid: true } }],
  idleTimeoutMs: 60_000,
  logger: (event, ctx) => console.log(event, ctx),
});

await wallet.verifyBpin();

const records = await wallet.exportPubkeys();

const signature = await wallet.signMessage({
  hash: 'AABBCC...',
  coinType: 60,
  index: 0,
});

const version = await wallet.getVersion();

### Wallet options

| Option | Description |
| --- | --- |
| transports | List of transport candidates (Android defaults to APDU; iOS defaults to BLE). You can override order and options. |
| logger | (event, context) => void for tracking channel open/close and operations. |
| idleTimeoutMs | Auto-close the session after this idle timeout. Default is 60 seconds. |
| platform | Override platform ('android' / 'ios') in tests; defaults to Platform.OS. |

The wallet serializes operations to avoid concurrent sessions. If the first transport fails to open, it tries the next one.

### Error types

- TransportError: channel not open, invalid APDU request, native bridge failure, etc.
- BSIMError: legacy business error codes (A000, 63Cx, etc.).
- ApduFlowError: APDU result status indicates a business failure.

Catch errors at the call site and check code for custom handling.
```
