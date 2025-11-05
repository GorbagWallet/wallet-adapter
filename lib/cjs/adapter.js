"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
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
        this.icon = 'https://gorbag.vercel.app/logos/icon.png'; // This is a placeholder SVG data URL
        this.supportedTransactionVersions = new Set(['legacy', 0]);
        this._readyState = typeof window === 'undefined' || typeof document === 'undefined'
            ? wallet_adapter_base_1.WalletReadyState.Unsupported
            : wallet_adapter_base_1.WalletReadyState.NotDetected;
        this._handleConnect = () => {
            // Handle connect event from wallet
            // Usually, we get the public key from the wallet after connect
            const wallet = this._wallet;
            if (wallet && wallet.publicKey) {
                try {
                    const newPublicKey = new web3_js_1.PublicKey(wallet.publicKey.toBytes());
                    this._publicKey = newPublicKey;
                    this.emit('connect', newPublicKey);
                }
                catch (error) {
                    this.emit('error', new wallet_adapter_base_1.WalletPublicKeyError(error === null || error === void 0 ? void 0 : error.message, error));
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
                // newPublicKey should already be a PublicKey instance based on our interface definition
                if (!(newPublicKey instanceof web3_js_1.PublicKey)) {
                    // If it's coming as a different format from wallet, handle appropriately
                    // But based on our interface, it should be PublicKey
                    this.emit('error', new wallet_adapter_base_1.WalletPublicKeyError('Invalid public key format from wallet'));
                    return;
                }
            }
            catch (error) {
                this.emit('error', new wallet_adapter_base_1.WalletPublicKeyError(error === null || error === void 0 ? void 0 : error.message, error));
                return;
            }
            if (publicKey.equals(newPublicKey))
                return;
            this._publicKey = newPublicKey;
            this.emit('connect', newPublicKey); // Re-emit connect with new public key
        };
        this._connecting = false;
        this._wallet = null;
        this._publicKey = null;
        if (this._readyState !== wallet_adapter_base_1.WalletReadyState.Unsupported) {
            if ((0, wallet_adapter_base_1.isIosAndRedirectable)()) {
                // when in iOS (not webview), set Gorbag as loadable instead of checking for install
                this._readyState = wallet_adapter_base_1.WalletReadyState.Loadable;
                this.emit('readyStateChange', this._readyState);
            }
            else {
                (0, wallet_adapter_base_1.scopePollingDetectionStrategy)(() => {
                    var _a, _b, _c;
                    if (((_b = (_a = window.gorbag) === null || _a === void 0 ? void 0 : _a.solana) === null || _b === void 0 ? void 0 : _b.isGorbag) || ((_c = window.solana) === null || _c === void 0 ? void 0 : _c.isGorbag)) {
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
    get readyState() {
        return this._readyState;
    }
    async autoConnect() {
        // Skip autoconnect in the Loadable state
        // We can't redirect to a universal link without user input
        if (this.readyState === wallet_adapter_base_1.WalletReadyState.Installed) {
            await this.connect();
        }
    }
    async connect() {
        var _a;
        try {
            if (this.connecting)
                return;
            if (this.readyState === wallet_adapter_base_1.WalletReadyState.Loadable) {
                // redirect to the Gorbag universal link (placeholder)
                // this will open the current URL in the Gorbag in-wallet browser
                const url = encodeURIComponent(window.location.href);
                const ref = encodeURIComponent(window.location.origin);
                // For now, just throw an error since Gorbag doesn't have a universal link
                throw new wallet_adapter_base_1.WalletNotReadyError('Gorbag universal link not available');
                // window.location.href = `gorbag://browse/${url}?ref=${ref}`;
                // return;
            }
            if (this.readyState !== wallet_adapter_base_1.WalletReadyState.Installed)
                throw new wallet_adapter_base_1.WalletNotReadyError();
            this._connecting = true;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const wallet = ((_a = window.gorbag) === null || _a === void 0 ? void 0 : _a.solana) || window.solana;
            if (!wallet.isConnected) {
                try {
                    await wallet.connect();
                }
                catch (error) {
                    throw new wallet_adapter_base_1.WalletConnectionError(error === null || error === void 0 ? void 0 : error.message, error);
                }
            }
            if (!wallet.publicKey)
                throw new wallet_adapter_base_1.WalletAccountError();
            let publicKey;
            try {
                publicKey = new web3_js_1.PublicKey(wallet.publicKey.toBytes());
            }
            catch (error) {
                throw new wallet_adapter_base_1.WalletPublicKeyError(error === null || error === void 0 ? void 0 : error.message, error);
            }
            // Attach event listeners to the wallet
            const connectHandler = this._handleConnect;
            const disconnectHandler = this._handleDisconnect;
            const accountChangedHandler = this._handleAccountChanged;
            // Store handlers for later removal
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
            // Remove event listeners using stored handlers
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
                this.emit('error', new wallet_adapter_base_1.WalletDisconnectionError(error === null || error === void 0 ? void 0 : error.message, error));
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
                const { signers } = options, sendOptions = __rest(options, ["signers"]);
                if ((0, wallet_adapter_base_1.isVersionedTransaction)(transaction)) {
                    (signers === null || signers === void 0 ? void 0 : signers.length) && transaction.sign(signers);
                }
                else {
                    transaction = (await this.prepareTransaction(transaction, connection, sendOptions));
                    (signers === null || signers === void 0 ? void 0 : signers.length) && transaction.partialSign(...signers);
                }
                sendOptions.preflightCommitment = sendOptions.preflightCommitment || connection.commitment;
                const { signature } = await wallet.signAndSendTransaction(transaction, sendOptions);
                return signature;
            }
            catch (error) {
                if (error instanceof wallet_adapter_base_1.WalletError)
                    throw error;
                throw new wallet_adapter_base_1.WalletSendTransactionError(error === null || error === void 0 ? void 0 : error.message, error);
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
                throw new wallet_adapter_base_1.WalletSignTransactionError(error === null || error === void 0 ? void 0 : error.message, error);
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
                throw new wallet_adapter_base_1.WalletSignTransactionError(error === null || error === void 0 ? void 0 : error.message, error);
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
                throw new wallet_adapter_base_1.WalletSignMessageError(error === null || error === void 0 ? void 0 : error.message, error);
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