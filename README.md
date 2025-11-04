# Gorbag Wallet Adapter

[![npm](https://img.shields.io/npm/v/@gorbag/wallet-adapter)](https://www.npmjs.com/package/@gorbag/wallet-adapter)
[![license](https://img.shields.io/npm/l/@gorbag/wallet-adapter)](https://github.com/DavidNzube101/gorbag-wallet/blob/main/packages/gorbag-adapter/LICENSE)

Wallet adapter for Gorbag Wallet that enables dApps to connect using the standard Solana wallet interface.

## Installation

```bash
npm install @gorbag/wallet-adapter
```

## Overview

The Gorbag Wallet Adapter allows decentralized applications (dApps) to connect to the Gorbag Wallet using the same standard interface as other Solana wallets like Phantom and Solflare. This implementation follows the Solana wallet standard, making it easy for dApps to integrate Gorbag support alongside other wallet options.

## Features

- Full compatibility with standard Solana wallet adapter patterns
- Support for transaction signing (legacy and versioned)
- Message signing capabilities
- Connection and disconnection handling
- Event emission for wallet state changes
- iOS support with universal link handling

## Usage

```typescript
import { GorbagWalletAdapter } from '@gorbag/wallet-adapter';

// Create adapter instance
const adapter = new GorbagWalletAdapter();

// Connect to wallet
await adapter.connect();

// Sign a transaction
const signature = await adapter.signTransaction(transaction);

// Send a transaction
const signature = await adapter.sendTransaction(transaction, connection);
```

## Compatibility

This adapter works with the Gorbag browser extension when it injects the standard wallet interface into the page (`window.gorbag.solana` or `window.solana`).

## License

Apache 2.0 - See [LICENSE](./LICENSE) for details.

## Author

David Nzube (Skipp)