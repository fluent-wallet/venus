# This monorepo enables the core functionality of a cross-end crypto wallet.

## Package Introduce

### database

Implemented the core database of a multi-chain wallet using [watermelondb](https://watermelondb.dev/docs) and provided query/create table functionality by Model organization.

Instead of writing data directly to the database, developers should use the Wallet Behavior abstract methods in the Methods folder of WalletCore described below.

<br />

### WalletCore

Abstract Object for wallet behavior(methods), events, and life cycles.

And provides optional wallet functionality plugins , such as Provider injection / RPC response / React hooks data connection methods and so on.。。

Support for overriding and linking to plugins/Methods/Events is also provided.

A complete wallet app can be implemented using WalletCore in the ui layer.

### utils

Utils for wallet development, For example, generating mnemonics, etc...

Generally only used in database and WalletCore.

<br />

### contracts

Contract ABI and use method.

Generally only used in database and WalletCore.