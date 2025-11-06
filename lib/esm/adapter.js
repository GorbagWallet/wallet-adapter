import { BaseMessageSignerWalletAdapter, isIosAndRedirectable, scopePollingDetectionStrategy, WalletAccountError, WalletConnectionError, WalletDisconnectedError, WalletDisconnectionError, WalletNotConnectedError, WalletNotReadyError, WalletPublicKeyError, WalletReadyState, WalletSignMessageError, WalletSignTransactionError, } from '@gorbag/wallet-adapter-base';
import { PublicKey } from '@solana/web3.js';
export const GorbagWalletName = 'Gorbag';
export class GorbagWalletAdapter extends BaseMessageSignerWalletAdapter {
    constructor(config = {}) {
        super();
        this.name = GorbagWalletName;
        this.url = 'https://github.com/GorbagWallet/gorbag-wallet';
        this.icon = 'https://gorbag.vercel.app/logos/icon.png';
        this.supportedTransactionVersions = new Set(['legacy', 0]);
        this._connecting = false;
        this._wallet = null;
        this._readyState = typeof window === 'undefined' || typeof document === 'undefined'
            ? WalletReadyState.Unsupported
            : WalletReadyState.NotDetected;
        this._handleConnect = () => {
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
                }
                catch (error) {
                    this.emit('error', new WalletPublicKeyError(error?.message, error));
                }
            }
        };
        this._handleDisconnect = () => {
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
        this._handleAccountChanged = (newPublicKey) => {
            const publicKey = this.publicKey; // Use getter from base class
            if (!publicKey)
                return;
            try {
                if (!(newPublicKey instanceof PublicKey)) {
                    this.emit('error', new WalletPublicKeyError('Invalid public key format from wallet'));
                    return;
                }
            }
            catch (error) {
                this.emit('error', new WalletPublicKeyError(error?.message, error));
                return;
            }
            if (publicKey.equals(newPublicKey))
                return;
            // Update the public key
            Object.defineProperty(this, '_publicKey', {
                value: newPublicKey,
                writable: true,
                configurable: true
            });
            this.emit('connect', newPublicKey);
        };
        if (this._readyState !== WalletReadyState.Unsupported) {
            // Check immediately if wallet exists
            setTimeout(() => {
                this._checkWalletReady();
            }, 0);
            if (isIosAndRedirectable()) {
                this.setReadyState(WalletReadyState.Loadable);
            }
            else {
                scopePollingDetectionStrategy(() => {
                    return this._checkWalletReady();
                });
            }
        }
    }
    // Protected setter that handles emission - now with type-safe emit
    setReadyState(state) {
        if (this._readyState === state)
            return;
        this._readyState = state;
        this.emit('readyStateChange', state);
    }
    _checkWalletReady() {
        const isAvailable = !!(window.gorbag?.solana?.isGorbag || window.solana?.isGorbag);
        if (isAvailable && this._readyState !== WalletReadyState.Installed) {
            this.setReadyState(WalletReadyState.Installed);
        }
        else if (!isAvailable && this._readyState !== WalletReadyState.NotDetected && this._readyState !== WalletReadyState.Unsupported) {
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
    async autoConnect() {
        if (this.readyState === WalletReadyState.Installed) {
            await this.connect();
        }
    }
    async connect() {
        try {
            if (this.connecting)
                return;
            if (this.readyState === WalletReadyState.Loadable) {
                throw new WalletNotReadyError('Gorbag universal link not available');
            }
            if (this.readyState !== WalletReadyState.Installed)
                throw new WalletNotReadyError();
            this._connecting = true;
            const wallet = window.gorbag?.solana || window.solana;
            if (!wallet.isConnected) {
                try {
                    await wallet.connect();
                }
                catch (error) {
                    throw new WalletConnectionError(error?.message, error);
                }
            }
            if (!wallet.publicKey)
                throw new WalletAccountError();
            let publicKey;
            try {
                publicKey = new PublicKey(wallet.publicKey.toBytes());
            }
            catch (error) {
                throw new WalletPublicKeyError(error?.message, error);
            }
            const connectHandler = this._handleConnect.bind(this);
            const disconnectHandler = this._handleDisconnect.bind(this);
            const accountChangedHandler = this._handleAccountChanged.bind(this);
            wallet._connectHandler = connectHandler;
            wallet._disconnectHandler = disconnectHandler;
            wallet._accountChangedHandler = accountChangedHandler;
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
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
        finally {
            this._connecting = false;
        }
    }
    async disconnect() {
        const wallet = this._wallet;
        if (wallet) {
            if (wallet._connectHandler) {
                wallet.off('connect', wallet._connectHandler);
            }
            if (wallet._disconnectHandler) {
                wallet.off('disconnect', wallet._disconnectHandler);
            }
            if (wallet._accountChangedHandler) {
                wallet.off('accountChanged', wallet._accountChangedHandler);
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
            }
            catch (error) {
                this.emit('error', new WalletDisconnectionError(error?.message, error));
            }
        }
        this.emit('disconnect');
    }
    async signTransaction(transaction) {
        try {
            const wallet = this._wallet;
            if (!wallet)
                throw new WalletNotConnectedError();
            try {
                return (await wallet.signTransaction(transaction)) || transaction;
            }
            catch (error) {
                throw new WalletSignTransactionError(error?.message, error);
            }
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    async signAllTransactions(transactions) {
        try {
            const wallet = this._wallet;
            if (!wallet)
                throw new WalletNotConnectedError();
            try {
                return (await wallet.signAllTransactions(transactions)) || transactions;
            }
            catch (error) {
                throw new WalletSignTransactionError(error?.message, error);
            }
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    async signMessage(message) {
        try {
            const wallet = this._wallet;
            if (!wallet)
                throw new WalletNotConnectedError();
            try {
                const { signature } = await wallet.signMessage(message);
                return signature;
            }
            catch (error) {
                throw new WalletSignMessageError(error?.message, error);
            }
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
}
//# sourceMappingURL=adapter.js.map