import type { 
    EventEmitter, 
    SendTransactionOptions, 
    WalletName, 
    TransactionOrVersionedTransaction,
    TransactionVersion 
} from '@gorbag/wallet-adapter-base';
import {
    BaseMessageSignerWalletAdapter,
    isIosAndRedirectable,
    isVersionedTransaction,
    scopePollingDetectionStrategy,
    WalletAccountError,
    WalletConnectionError,
    WalletDisconnectedError,
    WalletDisconnectionError,
    WalletError,
    WalletNotConnectedError,
    WalletNotReadyError,
    WalletPublicKeyError,
    WalletReadyState,
    WalletSendTransactionError,
    WalletSignMessageError,
    WalletSignTransactionError,
} from '@gorbag/wallet-adapter-base';
import {
    Connection,
    SendOptions,
    Transaction,
    TransactionSignature,
    VersionedTransaction,
    PublicKey
} from '@solana/web3.js';

interface GorbagWalletEvents {
    connect(...args: unknown[]): unknown;
    disconnect(...args: unknown[]): unknown;
    accountChanged(newPublicKey: PublicKey): unknown;
}

interface GorbagWallet extends EventEmitter<GorbagWalletEvents> {
    isGorbag?: boolean;
    publicKey?: { toBytes(): Uint8Array };
    isConnected: boolean;
    signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
    signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
    signAndSendTransaction<T extends Transaction | VersionedTransaction>(
        transaction: T,
        options?: SendOptions
    ): Promise<{ signature: TransactionSignature }>;
    signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
}

interface GorbagWindow extends Window {
    gorbag?: {
        solana?: GorbagWallet;
    };
    solana?: GorbagWallet;
}

declare const window: GorbagWindow;

export interface GorbagWalletAdapterConfig {}

export const GorbagWalletName = 'Gorbag' as WalletName<'Gorbag'>;

export class GorbagWalletAdapter extends BaseMessageSignerWalletAdapter {
    name = GorbagWalletName;
    url = 'https://github.com/GorbagWallet/gorbag-wallet';
    icon = 'https://gorbag.vercel.app/logos/icon.png'; // This is a placeholder SVG data URL
    supportedTransactionVersions?: Set<'legacy' | 0> = new Set<'legacy' | 0>(['legacy', 0]);

    private _connecting: boolean;
    private _wallet: GorbagWallet | null;
    private _publicKey: PublicKey | null;
    private _readyState: WalletReadyState =
        typeof window === 'undefined' || typeof document === 'undefined'
            ? WalletReadyState.Unsupported
            : WalletReadyState.NotDetected;

    constructor(config: GorbagWalletAdapterConfig = {}) {
        super();
        this._connecting = false;
        this._wallet = null;
        this._publicKey = null;

        if (this._readyState !== WalletReadyState.Unsupported) {
            if (isIosAndRedirectable()) {
                // when in iOS (not webview), set Gorbag as loadable instead of checking for install
                this._readyState = WalletReadyState.Loadable;
                this.emit('readyStateChange', this._readyState);
            } else {
                scopePollingDetectionStrategy(() => {
                    if (window.gorbag?.solana?.isGorbag || window.solana?.isGorbag) {
                        this._readyState = WalletReadyState.Installed;
                        this.emit('readyStateChange', this._readyState);
                        return true;
                    }
                    return false;
                });
            }
        }
    }

    get publicKey() {
        return this._publicKey;
    }

    get connecting() {
        return this._connecting;
    }

    get readyState() {
        return this._readyState;
    }

    async autoConnect(): Promise<void> {
        // Skip autoconnect in the Loadable state
        // We can't redirect to a universal link without user input
        if (this.readyState === WalletReadyState.Installed) {
            await this.connect();
        }
    }

    async connect(): Promise<void> {
        try {
            if (this.connecting) return;

            if (this.readyState === WalletReadyState.Loadable) {
                // redirect to the Gorbag universal link (placeholder)
                // this will open the current URL in the Gorbag in-wallet browser
                const url = encodeURIComponent(window.location.href);
                const ref = encodeURIComponent(window.location.origin);
                // For now, just throw an error since Gorbag doesn't have a universal link
                throw new WalletNotReadyError('Gorbag universal link not available');
                // window.location.href = `gorbag://browse/${url}?ref=${ref}`;
                // return;
            }

            if (this.readyState !== WalletReadyState.Installed) throw new WalletNotReadyError();

            this._connecting = true;

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const wallet = window.gorbag?.solana || window.solana!;

            if (!wallet.isConnected) {
                try {
                    await wallet.connect();
                } catch (error: any) {
                    throw new WalletConnectionError(error?.message, error);
                }
            }

            if (!wallet.publicKey) throw new WalletAccountError();

            let publicKey: PublicKey;
            try {
                publicKey = new PublicKey(wallet.publicKey.toBytes());
            } catch (error: any) {
                throw new WalletPublicKeyError(error?.message, error);
            }

            // Attach event listeners to the wallet
            const connectHandler = this._handleConnect;
            const disconnectHandler = this._handleDisconnect;
            const accountChangedHandler = this._handleAccountChanged;
            
            // Store handlers for later removal
            (wallet as any)._connectHandler = connectHandler;
            (wallet as any)._disconnectHandler = disconnectHandler;
            (wallet as any)._accountChangedHandler = accountChangedHandler;

            wallet.on('connect', connectHandler);
            wallet.on('disconnect', disconnectHandler);
            wallet.on('accountChanged', accountChangedHandler);

            this._wallet = wallet;
            this._publicKey = publicKey;

            this.emit('connect', publicKey);
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        } finally {
            this._connecting = false;
        }
    }

    async disconnect(): Promise<void> {
        const wallet = this._wallet;
        if (wallet) {
            // Remove event listeners using stored handlers
            if ((wallet as any)._connectHandler) {
                wallet.off('connect', (wallet as any)._connectHandler);
            }
            if ((wallet as any)._disconnectHandler) {
                wallet.off('disconnect', (wallet as any)._disconnectHandler);
            }
            if ((wallet as any)._accountChangedHandler) {
                wallet.off('accountChanged', (wallet as any)._accountChangedHandler);
            }

            this._wallet = null;
            this._publicKey = null;

            try {
                await wallet.disconnect();
            } catch (error: any) {
                this.emit('error', new WalletDisconnectionError(error?.message, error));
            }
        }

        this.emit('disconnect');
    }

    async sendTransaction<T extends TransactionOrVersionedTransaction<this['supportedTransactionVersions']>>(
        transaction: T,
        connection: Connection,
        options: SendTransactionOptions = {}
    ): Promise<TransactionSignature> {
        try {
            const wallet = this._wallet;
            if (!wallet) throw new WalletNotConnectedError();

            try {
                const { signers, ...sendOptions } = options;

                if (isVersionedTransaction(transaction)) {
                    signers?.length && transaction.sign(signers);
                } else {
                    transaction = (await this.prepareTransaction(transaction, connection, sendOptions)) as T;
                    signers?.length && (transaction as Transaction).partialSign(...signers);
                }

                sendOptions.preflightCommitment = sendOptions.preflightCommitment || connection.commitment;

                const { signature } = await wallet.signAndSendTransaction(transaction, sendOptions);
                return signature;
            } catch (error: any) {
                if (error instanceof WalletError) throw error;
                throw new WalletSendTransactionError(error?.message, error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
        try {
            const wallet = this._wallet;
            if (!wallet) throw new WalletNotConnectedError();

            try {
                return (await wallet.signTransaction(transaction)) || transaction;
            } catch (error: any) {
                throw new WalletSignTransactionError(error?.message, error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
        try {
            const wallet = this._wallet;
            if (!wallet) throw new WalletNotConnectedError();

            try {
                return (await wallet.signAllTransactions(transactions)) || transactions;
            } catch (error: any) {
                throw new WalletSignTransactionError(error?.message, error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    async signMessage(message: Uint8Array): Promise<Uint8Array> {
        try {
            const wallet = this._wallet;
            if (!wallet) throw new WalletNotConnectedError();

            try {
                const { signature } = await wallet.signMessage(message);
                return signature;
            } catch (error: any) {
                throw new WalletSignMessageError(error?.message, error);
            }
        } catch (error: any) {
            this.emit('error', error);
            throw error;
        }
    }

    private _handleConnect = () => {
        // Handle connect event from wallet
        // Usually, we get the public key from the wallet after connect
        const wallet = this._wallet;
        if (wallet && wallet.publicKey) {
            try {
                const newPublicKey = new PublicKey(wallet.publicKey.toBytes());
                this._publicKey = newPublicKey;
                this.emit('connect', newPublicKey);
            } catch (error: any) {
                this.emit('error', new WalletPublicKeyError(error?.message, error));
            }
        }
    };

    private _handleDisconnect = () => {
        this._wallet = null;
        this._publicKey = null;
        
        this.emit('error', new WalletDisconnectedError());
        this.emit('disconnect');
    };

    private _handleAccountChanged = (newPublicKey: PublicKey) => {
        const publicKey = this._publicKey;
        if (!publicKey) return;

        try {
            // newPublicKey should already be a PublicKey instance based on our interface definition
            if (!(newPublicKey instanceof PublicKey)) {
                // If it's coming as a different format from wallet, handle appropriately
                // But based on our interface, it should be PublicKey
                this.emit('error', new WalletPublicKeyError('Invalid public key format from wallet'));
                return;
            }
        } catch (error: any) {
            this.emit('error', new WalletPublicKeyError(error?.message, error));
            return;
        }

        if (publicKey.equals(newPublicKey)) return;

        this._publicKey = newPublicKey;
        this.emit('connect', newPublicKey); // Re-emit connect with new public key
    };
}
