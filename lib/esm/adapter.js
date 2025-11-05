import { BaseMessageSignerWalletAdapter, isIosAndRedirectable, isVersionedTransaction, scopePollingDetectionStrategy, WalletAccountError, WalletConnectionError, WalletDisconnectedError, WalletDisconnectionError, WalletError, WalletNotConnectedError, WalletNotReadyError, WalletPublicKeyError, WalletReadyState, WalletSendTransactionError, WalletSignMessageError, WalletSignTransactionError, } from '@gorbag/wallet-adapter-base.js';
import { PublicKey } from '@solana/web3.js';
export const GorbagWalletName = 'Gorbag.js';
export class GorbagWalletAdapter extends BaseMessageSignerWalletAdapter {
    constructor(config = {}) {
        super();
        this.name = GorbagWalletName;
        this.url = 'https://github.com/GorbagWallet/gorbag-wallet.js';
        this.icon = 'https://gorbag.vercel.app/logos/icon.png.js'; // This is a placeholder SVG data URL
        this.supportedTransactionVersions = new Set(['legacy', 0]);
        this._readyState = typeof window === 'undefined' || typeof document === 'undefined'
            ? WalletReadyState.Unsupported
            : WalletReadyState.NotDetected;
        this._handleConnect = () => {
            // Handle connect event from wallet
            // Usually, we get the public key from the wallet after connect
            const wallet = this._wallet;
            if (wallet && wallet.publicKey) {
                try {
                    const newPublicKey = new PublicKey(wallet.publicKey.toBytes());
                    this._publicKey = newPublicKey;
                    this.emit('connect', newPublicKey);
                }
                catch (error) {
                    this.emit('error', new WalletPublicKeyError(error?.message, error));
                }
            }
        };
        this._handleDisconnect = () => {
            this._wallet = null;
            this._publicKey = null;
            this.emit('error', new WalletDisconnectedError());
            this.emit('disconnect');
        };
        this._handleAccountChanged = (newPublicKey) => {
            const publicKey = this._publicKey;
            if (!publicKey)
                return;
            try {
                // newPublicKey should already be a PublicKey instance based on our interface definition
                if (!(newPublicKey instanceof PublicKey)) {
                    // If it's coming as a different format from wallet, handle appropriately
                    // But based on our interface, it should be PublicKey
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
            this._publicKey = newPublicKey;
            this.emit('connect', newPublicKey); // Re-emit connect with new public key
        };
        this._connecting = false;
        this._wallet = null;
        this._publicKey = null;
        if (this._readyState !== WalletReadyState.Unsupported) {
            if (isIosAndRedirectable()) {
                // when in iOS (not webview), set Gorbag as loadable instead of checking for install
                this._readyState = WalletReadyState.Loadable;
                this.emit('readyStateChange', this._readyState);
            }
            else {
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
    async autoConnect() {
        // Skip autoconnect in the Loadable state
        // We can't redirect to a universal link without user input
        if (this.readyState === WalletReadyState.Installed) {
            await this.connect();
        }
    }
    async connect() {
        try {
            if (this.connecting)
                return;
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
            if (this.readyState !== WalletReadyState.Installed)
                throw new WalletNotReadyError();
            this._connecting = true;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
                this.emit('error', new WalletDisconnectionError(error?.message, error));
            }
        }
        this.emit('disconnect');
    }
    async sendTransaction(transaction, connection, options = {}) {
        try {
            const wallet = this._wallet;
            if (!wallet)
                throw new WalletNotConnectedError();
            try {
                const { signers, ...sendOptions } = options;
                if (isVersionedTransaction(transaction)) {
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
                if (error instanceof WalletError)
                    throw error;
                throw new WalletSendTransactionError(error?.message, error);
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