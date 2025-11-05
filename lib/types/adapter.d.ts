import type { SendTransactionOptions, WalletName, TransactionOrVersionedTransaction, WalletAdapterEvents } from '@gorbag/wallet-adapter-base';
import { Connection, SendOptions, Transaction, TransactionSignature, VersionedTransaction, PublicKey } from '@solana/web3.js';
export interface GorbagWalletAdapterConfig {
}
export declare const GorbagWalletName: WalletName<"Gorbag">;
export declare class GorbagWalletAdapter {
    name: WalletName<"Gorbag">;
    url: string;
    icon: string;
    supportedTransactionVersions?: Set<'legacy' | 0>;
    private _connecting;
    private _wallet;
    private _publicKey;
    private _readyState;
    private _emitter;
    constructor(config?: GorbagWalletAdapterConfig);
    get publicKey(): PublicKey;
    get connecting(): boolean;
    get connected(): boolean;
    get readyState(): WalletReadyState;
    on<E extends keyof WalletAdapterEvents>(event: E, listener: WalletAdapterEvents[E], context?: any): this;
    emit<E extends keyof WalletAdapterEvents>(event: E, ...args: Parameters<WalletAdapterEvents[E]>): this;
    removeListener<E extends keyof WalletAdapterEvents>(event: E, listener?: WalletAdapterEvents[E], context?: any): this;
    autoConnect(): Promise<void>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    sendTransaction<T extends TransactionOrVersionedTransaction<this['supportedTransactionVersions']>>(transaction: T, connection: Connection, options?: SendTransactionOptions): Promise<TransactionSignature>;
    signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
    signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
    signMessage(message: Uint8Array): Promise<Uint8Array>;
    protected prepareTransaction(transaction: Transaction, connection: Connection, options?: SendOptions): Promise<Transaction>;
    private _handleConnect;
    private _handleDisconnect;
    private _handleAccountChanged;
}
//# sourceMappingURL=adapter.d.ts.map