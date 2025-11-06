"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GorbagWalletAdapter = exports.GorbagWalletName = void 0;
const wallet_adapter_base_1 = require("@gorbag/wallet-adapter-base");
const web3_js_1 = require("@solana/web3.js");
exports.GorbagWalletName = 'Gorbag';
class GorbagWalletAdapter extends wallet_adapter_base_1.BaseMessageSignerWalletAdapter {
    constructor(config = {}) {
        super();
        this.name = exports.GorbagWalletName;
        this.url = 'https://github.com/GorbagWallet/gorbag-wallet';
        this.icon = 'https://gorbag.vercel.app/logos/icon.png';
        this.supportedTransactionVersions = new Set(['legacy', 0]);
        this._connecting = false;
        this._wallet = null;
        this._readyState = typeof window === 'undefined' || typeof document === 'undefined'
            ? wallet_adapter_base_1.WalletReadyState.Unsupported
            : wallet_adapter_base_1.WalletReadyState.NotDetected;
        this._handleConnect = () => {
            const wallet = this._wallet;
            if (wallet && wallet.publicKey) {
                try {
                    const newPublicKey = new web3_js_1.PublicKey(wallet.publicKey.toBytes());
                    // Update the public key
                    Object.defineProperty(this, '_publicKey', {
                        value: newPublicKey,
                        writable: true,
                        configurable: true
                    });
                    this.emit('connect', newPublicKey);
                }
                catch (error) {
                    this.emit('error', new wallet_adapter_base_1.WalletPublicKeyError(error?.message, error));
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
            this.emit('error', new wallet_adapter_base_1.WalletDisconnectedError());
            this.emit('disconnect');
        };
        this._handleAccountChanged = (newPublicKey) => {
            const publicKey = this.publicKey; // Use getter from base class
            if (!publicKey)
                return;
            try {
                if (!(newPublicKey instanceof web3_js_1.PublicKey)) {
                    this.emit('error', new wallet_adapter_base_1.WalletPublicKeyError('Invalid public key format from wallet'));
                    return;
                }
            }
            catch (error) {
                this.emit('error', new wallet_adapter_base_1.WalletPublicKeyError(error?.message, error));
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
        if (this._readyState !== wallet_adapter_base_1.WalletReadyState.Unsupported) {
            // Check immediately if wallet exists
            setTimeout(() => {
                this._checkWalletReady();
            }, 0);
            if ((0, wallet_adapter_base_1.isIosAndRedirectable)()) {
                this.setReadyState(wallet_adapter_base_1.WalletReadyState.Loadable);
            }
            else {
                (0, wallet_adapter_base_1.scopePollingDetectionStrategy)(() => {
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
        if (isAvailable && this._readyState !== wallet_adapter_base_1.WalletReadyState.Installed) {
            this.setReadyState(wallet_adapter_base_1.WalletReadyState.Installed);
        }
        else if (!isAvailable && this._readyState !== wallet_adapter_base_1.WalletReadyState.NotDetected && this._readyState !== wallet_adapter_base_1.WalletReadyState.Unsupported) {
            // Only set back to NotDetected if wallet is no longer available and not in Unsupported state
            this.setReadyState(wallet_adapter_base_1.WalletReadyState.NotDetected);
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
        if (this.readyState === wallet_adapter_base_1.WalletReadyState.Installed) {
            await this.connect();
        }
    }
    async connect() {
        try {
            if (this.connecting)
                return;
            if (this.readyState === wallet_adapter_base_1.WalletReadyState.Loadable) {
                throw new wallet_adapter_base_1.WalletNotReadyError('Gorbag universal link not available');
            }
            if (this.readyState !== wallet_adapter_base_1.WalletReadyState.Installed)
                throw new wallet_adapter_base_1.WalletNotReadyError();
            this._connecting = true;
            const wallet = window.gorbag?.solana || window.solana;
            if (!wallet.isConnected) {
                try {
                    await wallet.connect();
                }
                catch (error) {
                    throw new wallet_adapter_base_1.WalletConnectionError(error?.message, error);
                }
            }
            if (!wallet.publicKey)
                throw new wallet_adapter_base_1.WalletAccountError();
            let publicKey;
            try {
                publicKey = new web3_js_1.PublicKey(wallet.publicKey.toBytes());
            }
            catch (error) {
                throw new wallet_adapter_base_1.WalletPublicKeyError(error?.message, error);
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
                this.emit('error', new wallet_adapter_base_1.WalletDisconnectionError(error?.message, error));
            }
        }
        this.emit('disconnect');
    }
    async signTransaction(transaction) {
        try {
            const wallet = this._wallet;
            if (!wallet)
                throw new wallet_adapter_base_1.WalletNotConnectedError();
            try {
                return (await wallet.signTransaction(transaction)) || transaction;
            }
            catch (error) {
                throw new wallet_adapter_base_1.WalletSignTransactionError(error?.message, error);
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
                throw new wallet_adapter_base_1.WalletNotConnectedError();
            try {
                return (await wallet.signAllTransactions(transactions)) || transactions;
            }
            catch (error) {
                throw new wallet_adapter_base_1.WalletSignTransactionError(error?.message, error);
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
                throw new wallet_adapter_base_1.WalletNotConnectedError();
            try {
                const { signature } = await wallet.signMessage(message);
                return signature;
            }
            catch (error) {
                throw new wallet_adapter_base_1.WalletSignMessageError(error?.message, error);
            }
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
}
exports.GorbagWalletAdapter = GorbagWalletAdapter;
//# sourceMappingURL=adapter.js.map