import type { SendTransactionOptions, WalletName, TransactionOrVersionedTransaction } from '@gorbag/wallet-adapter-base';
import { BaseMessageSignerWalletAdapter, WalletReadyState } from '@gorbag/wallet-adapter-base';
import { Connection, Transaction, TransactionSignature, VersionedTransaction, PublicKey } from '@solana/web3.js';
export interface GorbagWalletAdapterConfig {
}
export declare const GorbagWalletName: WalletName<"Gorbag">;
export declare class GorbagWalletAdapter extends BaseMessageSignerWalletAdapter {
    name: WalletName<"Gorbag">;
    url: string;
    icon: string;
    supportedTransactionVersions?: Set<'legacy' | 0>;
    private _connecting;
    private _wallet;
    private _publicKey;
    private _readyState;
    constructor(config?: GorbagWalletAdapterConfig);
    get publicKey(): PublicKey | null;
    get connecting(): boolean;
    get readyState(): WalletReadyState;
    autoConnect(): Promise<void>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    sendTransaction<T extends TransactionOrVersionedTransaction<this['supportedTransactionVersions']>>(transaction: T, connection: Connection, options?: SendTransactionOptions): Promise<TransactionSignature>;
    signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
    signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
    signMessage(message: Uint8Array): Promise<Uint8Array>;
    private _handleConnect;
    private _handleDisconnect;
    private _handleAccountChanged;
}
//# sourceMappingURL=adapter.d.ts.map