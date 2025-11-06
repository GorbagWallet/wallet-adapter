import type { WalletName, TransactionVersion, WalletAdapterEvents } from '@gorbag/wallet-adapter-base';
import { BaseMessageSignerWalletAdapter, WalletReadyState } from '@gorbag/wallet-adapter-base';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
export interface GorbagWalletAdapterConfig {
}
export declare const GorbagWalletName: WalletName<"Gorbag">;
export declare class GorbagWalletAdapter extends BaseMessageSignerWalletAdapter<'Gorbag'> {
    emit: <E extends keyof WalletAdapterEvents>(event: E, ...args: Parameters<WalletAdapterEvents[E]>) => boolean;
    name: WalletName<"Gorbag">;
    url: string;
    icon: string;
    supportedTransactionVersions: Set<TransactionVersion>;
    private _connecting;
    private _wallet;
    private _readyState;
    constructor(config?: GorbagWalletAdapterConfig);
    protected setReadyState(state: WalletReadyState): void;
    private _checkWalletReady;
    get publicKey(): any;
    get connecting(): boolean;
    get readyState(): WalletReadyState;
    autoConnect(): Promise<void>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
    signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
    signMessage(message: Uint8Array): Promise<Uint8Array>;
    private _handleConnect;
    private _handleDisconnect;
    private _handleAccountChanged;
}
//# sourceMappingURL=adapter.d.ts.map