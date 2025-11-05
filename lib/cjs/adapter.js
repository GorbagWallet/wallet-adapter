"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GorbagWalletAdapter = exports.GorbagWalletName = void 0;
const wallet_adapter_base_1 = require("@gorbag/wallet-adapter-base");
const web3_js_1 = require("@solana/web3.js");
const eventemitter3_1 = require("eventemitter3");
exports.GorbagWalletName = 'Gorbag';
class GorbagWalletAdapter {
    constructor(config = {}) {
        this.name = exports.GorbagWalletName;
        this.url = 'https://github.com/GorbagWallet/gorbag-wallet';
        this.icon = 'https://gorbag.vercel.app/logos/icon.png';
        this.supportedTransactionVersions = new Set(['legacy', 0]);
        this._readyState = typeof window === 'undefined' || typeof document === 'undefined'
            ? wallet_adapter_base_1.WalletReadyState.Unsupported
            : wallet_adapter_base_1.WalletReadyState.NotDetected;
        this._emitter = new eventemitter3_1.EventEmitter();
        this._handleConnect = () => {
            const wallet = this._wallet;
            if (wallet && wallet.publicKey) {
                try {
                    const newPublicKey = new web3_js_1.PublicKey(wallet.publicKey.toBytes());
                    this._publicKey = newPublicKey;
                    this.emit('connect', newPublicKey);
                }
                catch (error) {
                    this.emit('error', new wallet_adapter_base_1.WalletPublicKeyError(error?.message, error));
                }
            }
        };
        this._handleDisconnect = () => {
            this._wallet = null;
            this._publicKey = null;
            this.emit('error', new wallet_adapter_base_1.WalletDisconnectedError());
            this.emit('disconnect');
        };
        this._handleAccountChanged = (newPublicKey) => {
            const publicKey = this._publicKey;
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
            this._publicKey = newPublicKey;
            this.emit('connect', newPublicKey);
        };
        this._connecting = false;
        this._wallet = null;
        this._publicKey = null;
        if (this._readyState !== wallet_adapter_base_1.WalletReadyState.Unsupported) {
            if ((0, wallet_adapter_base_1.isIosAndRedirectable)()) {
                this._readyState = wallet_adapter_base_1.WalletReadyState.Loadable;
                this.emit('readyStateChange', this._readyState);
            }
            else {
                (0, wallet_adapter_base_1.scopePollingDetectionStrategy)(() => {
                    if (window.gorbag?.solana?.isGorbag || window.solana?.isGorbag) {
                        this._readyState = wallet_adapter_base_1.WalletReadyState.Installed;
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
    get connected() {
        return !!this._publicKey;
    }
    get readyState() {
        return this._readyState;
    }
    on(event, listener, context) {
        this._emitter.on(event, listener, context);
        return this;
    }
    emit(event, ...args) {
        this._emitter.emit(event, ...args);
        return this;
    }
    removeListener(event, listener, context) {
        this._emitter.removeListener(event, listener, context);
        return this;
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
            const connectHandler = this._handleConnect;
            const disconnectHandler = this._handleDisconnect;
            const accountChangedHandler = this._handleAccountChanged;
            wallet._connectHandler = connectHandler;
            wallet._disconnectHandler = disconnectHandler;
            wallet._accountChangedHandler = accountChangedHandler;
            wallet.on('connect', connectHandler);
            wallet.on('disconnect', disconnectHandler);
            wallet.on('accountChanged', accountChangedHandler);
            this._wallet = wallet;
            this._publicKey = publicKey;
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
            this._publicKey = null;
            try {
                await wallet.disconnect();
            }
            catch (error) {
                this.emit('error', new wallet_adapter_base_1.WalletDisconnectionError(error?.message, error));
            }
        }
        this.emit('disconnect');
    }
    async sendTransaction(transaction, connection, options = {}) {
        try {
            const wallet = this._wallet;
            if (!wallet)
                throw new wallet_adapter_base_1.WalletNotConnectedError();
            try {
                const { signers, ...sendOptions } = options;
                if ((0, wallet_adapter_base_1.isVersionedTransaction)(transaction)) {
                    signers?.length && transaction.sign(signers);
                }
                else {
                    transaction = (await this.prepareTransaction(transaction, connection, sendOptions));
                    signers?.length && transaction.partialSign(...signers);
                }
                sendOptions.preflightCommitment = sendOptions.preflightCommitment || connection.commitment;
                const { signature } = await wallet.signAndSendTransaction(transaction, sendOptions);
                return signature;
            }
            catch (error) {
                if (error instanceof wallet_adapter_base_1.WalletError)
                    throw error;
                throw new wallet_adapter_base_1.WalletSendTransactionError(error?.message, error);
            }
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
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
    async prepareTransaction(transaction, connection, options = {}) {
        const publicKey = this.publicKey;
        if (!publicKey)
            throw new Error('Wallet not connected');
        transaction.feePayer = transaction.feePayer || publicKey;
        transaction.recentBlockhash =
            transaction.recentBlockhash ||
                (await connection.getLatestBlockhash({
                    commitment: options.preflightCommitment,
                    minContextSlot: options.minContextSlot,
                })).blockhash;
        return transaction;
    }
}
exports.GorbagWalletAdapter = GorbagWalletAdapter;
//# sourceMappingURL=adapter.js.map