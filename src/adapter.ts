import type { 
    SendTransactionOptions, 
    WalletName, 
    TransactionOrVersionedTransaction,
    TransactionVersion,
    WalletAdapterEvents
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

interface EventEmitter {
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
}

interface GorbagWallet extends EventEmitter {
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

export class GorbagWalletAdapter extends BaseMessageSignerWalletAdapter<'Gorbag'> {
    // Declare emit method to fix TypeScript's type inference
    declare emit: <E extends keyof WalletAdapterEvents>(
        event: E,
        ...args: Parameters<WalletAdapterEvents[E]>
    ) => boolean;

    name = GorbagWalletName;
    url = 'https://github.com/GorbagWallet/gorbag-wallet';
    icon = 'https://gorbag.vercel.app/logos/icon.png';
    supportedTransactionVersions = new Set<'legacy' | 0>(['legacy', 0]) as Set<TransactionVersion>;

    private _connecting: boolean = false;
    private _wallet: GorbagWallet | null = null;
    private _readyState: WalletReadyState =
        typeof window === 'undefined' || typeof document === 'undefined'
            ? WalletReadyState.Unsupported
            : WalletReadyState.NotDetected;

    constructor(config: GorbagWalletAdapterConfig = {}) {
        super();
        
        if (this._readyState !== WalletReadyState.Unsupported) {
            // Check immediately if wallet exists
            setTimeout(() => {
                this._checkWalletReady();
            }, 0);
            
            if (isIosAndRedirectable()) {
                this.setReadyState(WalletReadyState.Loadable);
            } else {
                scopePollingDetectionStrategy(() => {
                    return this._checkWalletReady();
                });
            }
        }
    }

    // Protected setter that handles emission - now with type-safe emit
    protected setReadyState(state: WalletReadyState): void {
        if (this._readyState === state) return;
        
        this._readyState = state;
        this.emit('readyStateChange', state);
    }
    
    private _checkWalletReady(): boolean {
        const isAvailable = !!(window.gorbag?.solana?.isGorbag || window.solana?.isGorbag);
        
        if (isAvailable && this._readyState !== WalletReadyState.Installed) {
            this.setReadyState(WalletReadyState.Installed);
        } else if (!isAvailable && this._readyState !== WalletReadyState.NotDetected && this._readyState !== WalletReadyState.Unsupported) {
            // Only set back to NotDetected if wallet is no longer available and not in Unsupported state
            this.setReadyState(WalletReadyState.NotDetected);
        }
        
        return isAvailable;
    }

    get publicKey() {
        return super.publicKey;
    }

    get connecting() {
        return this._connecting;
    }

    get readyState() {
        return this._readyState;
    }

    async autoConnect(): Promise<void> {
        if (this.readyState === WalletReadyState.Installed) {
            await this.connect();
        }
    }

    async connect(): Promise<void> {
        try {
            if (this.connecting) return;

            if (this.readyState === WalletReadyState.Loadable) {
                throw new WalletNotReadyError('Gorbag universal link not available');
            }

            if (this.readyState !== WalletReadyState.Installed) throw new WalletNotReadyError();

            this._connecting = true;

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

            const connectHandler = this._handleConnect.bind(this);
            const disconnectHandler = this._handleDisconnect.bind(this);
            const accountChangedHandler = this._handleAccountChanged.bind(this);
            
            (wallet as any)._connectHandler = connectHandler;
            (wallet as any)._disconnectHandler = disconnectHandler;
            (wallet as any)._accountChangedHandler = accountChangedHandler;

            wallet.on('connect', connectHandler);
            wallet.on('disconnect', disconnectHandler);
            wallet.on('accountChanged', accountChangedHandler);

            this._wallet = wallet;
            // Set the public key using the setter from the base class
            Object.defineProperty(this, '_publicKey', {
                value: publicKey,
                writable: true,
                configurable: true
            });

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
            // Reset the public key
            Object.defineProperty(this, '_publicKey', {
                value: null,
                writable: true,
                configurable: true
            });

            try {
                await wallet.disconnect();
            } catch (error: any) {
                this.emit('error', new WalletDisconnectionError(error?.message, error));
            }
        }

        this.emit('disconnect');
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
        const wallet = this._wallet;
        if (wallet && wallet.publicKey) {
            try {
                const newPublicKey = new PublicKey(wallet.publicKey.toBytes());
                // Update the public key
                Object.defineProperty(this, '_publicKey', {
                    value: newPublicKey,
                    writable: true,
                    configurable: true
                });
                
                this.emit('connect', newPublicKey);
            } catch (error: any) {
                this.emit('error', new WalletPublicKeyError(error?.message, error));
            }
        }
    };

    private _handleDisconnect = () => {
        this._wallet = null;
        // Reset the public key
        Object.defineProperty(this, '_publicKey', {
            value: null,
            writable: true,
            configurable: true
        });
        
        this.emit('error', new WalletDisconnectedError());
        this.emit('disconnect');
    };

    private _handleAccountChanged = (newPublicKey: PublicKey) => {
        const publicKey = this.publicKey; // Use getter from base class
        if (!publicKey) return;

        try {
            if (!(newPublicKey instanceof PublicKey)) {
                this.emit('error', new WalletPublicKeyError('Invalid public key format from wallet'));
                return;
            }
        } catch (error: any) {
            this.emit('error', new WalletPublicKeyError(error?.message, error));
            return;
        }

        if (publicKey.equals(newPublicKey)) return;

        // Update the public key
        Object.defineProperty(this, '_publicKey', {
            value: newPublicKey,
            writable: true,
            configurable: true
        });
        
        this.emit('connect', newPublicKey);
    };
}
