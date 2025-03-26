"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainKp = exports.solanaConnection = void 0;
const spl_token_1 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
const constants_1 = require("./constants");
const utils_1 = require("./utils");
const bs58_1 = __importDefault(require("bs58"));
const swapOnlyAmm_1 = require("./utils/swapOnlyAmm");
const legacy_1 = require("./executor/legacy");
const jito_1 = require("./executor/jito");
exports.solanaConnection = new web3_js_1.Connection(constants_1.RPC_ENDPOINT, {
    wsEndpoint: constants_1.RPC_WEBSOCKET_ENDPOINT, commitment: "confirmed"
});
exports.mainKp = web3_js_1.Keypair.fromSecretKey(bs58_1.default.decode(constants_1.PRIVATE_KEY));
const baseMint = new web3_js_1.PublicKey(constants_1.TOKEN_MINT);
const distritbutionNum = constants_1.DISTRIBUTE_WALLET_NUM > 20 ? 20 : constants_1.DISTRIBUTE_WALLET_NUM;
const jitoCommitment = "confirmed";
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    const solBalance = yield exports.solanaConnection.getBalance(exports.mainKp.publicKey);
    console.log(`Volume bot is running`);
    console.log(`Wallet address: ${exports.mainKp.publicKey.toBase58()}`);
    console.log(`Pool token mint: ${baseMint.toBase58()}`);
    console.log(`Wallet SOL balance: ${(solBalance / web3_js_1.LAMPORTS_PER_SOL).toFixed(3)}SOL`);
    console.log(`Buying wait time max: ${constants_1.BUY_INTERVAL_MAX}s`);
    console.log(`Buying wait time min: ${constants_1.BUY_INTERVAL_MIN}s`);
    console.log(`Selling wait time max: ${constants_1.SELL_INTERVAL_MAX}s`);
    console.log(`Selling wait time min: ${constants_1.SELL_INTERVAL_MIN}s`);
    console.log(`Buy upper limit percent: ${constants_1.BUY_UPPER_PERCENT}%`);
    console.log(`Buy lower limit percent: ${constants_1.BUY_LOWER_PERCENT}%`);
    console.log(`Distribute SOL to ${distritbutionNum} wallets`);
    if (solBalance < constants_1.SOL_AMOUNT_TO_DISTRIBUTE * web3_js_1.LAMPORTS_PER_SOL) {
        console.log("Sol balance is not enough for distribution");
    }
    // main part
    for (;;) {
        try {
            console.log("---- New round of distribution ---- \n");
            let data = null;
            data = yield distributeSol(exports.solanaConnection, exports.mainKp, distritbutionNum);
            if (data == null || data.length == 0) {
                console.log("Distribution failed");
                continue;
            }
            const interval = Math.floor((constants_1.DISTRIBUTE_INTERVAL_MIN + Math.random() * (constants_1.DISTRIBUTE_INTERVAL_MAX - constants_1.DISTRIBUTE_INTERVAL_MIN)) * 1000);
            data.map((_a, n_1) => __awaiter(void 0, [_a, n_1], void 0, function* ({ kp }, n) {
                yield (0, utils_1.sleep)(Math.round(n * constants_1.BUY_INTERVAL_MAX / constants_1.DISTRIBUTE_WALLET_NUM * 1000));
                let srcKp = kp;
                // buy part with random percent
                const BUY_WAIT_INTERVAL = Math.round(Math.random() * (constants_1.BUY_INTERVAL_MAX - constants_1.BUY_INTERVAL_MIN) + constants_1.BUY_INTERVAL_MIN);
                const SELL_WAIT_INTERVAL = Math.round(Math.random() * (constants_1.SELL_INTERVAL_MAX - constants_1.SELL_INTERVAL_MIN) + constants_1.SELL_INTERVAL_MIN);
                const solBalance = yield exports.solanaConnection.getBalance(srcKp.publicKey);
                let buyAmountInPercent = Number((Math.random() * (constants_1.BUY_UPPER_PERCENT - constants_1.BUY_LOWER_PERCENT) + constants_1.BUY_LOWER_PERCENT).toFixed(3));
                if (solBalance < 8 * 10 ** 6) {
                    console.log("Sol balance is not enough in one of wallets");
                    return;
                }
                let buyAmountFirst = Math.floor((solBalance - 8 * 10 ** 6) / 100 * buyAmountInPercent);
                let buyAmountSecond = Math.floor(solBalance - buyAmountFirst - 8 * 10 ** 6);
                console.log(`balance: ${solBalance / 10 ** 9} first: ${buyAmountFirst / 10 ** 9} second: ${buyAmountSecond / 10 ** 9}`);
                // try buying until success
                let i = 0;
                while (true) {
                    try {
                        if (i > 10) {
                            console.log("Error in buy transaction");
                            return;
                        }
                        const result = yield buy(srcKp, baseMint, buyAmountFirst);
                        if (result) {
                            break;
                        }
                        else {
                            i++;
                            yield (0, utils_1.sleep)(2000);
                        }
                    }
                    catch (error) {
                        i++;
                    }
                }
                yield (0, utils_1.sleep)(BUY_WAIT_INTERVAL * 1000);
                let l = 0;
                while (true) {
                    try {
                        if (l > 10) {
                            console.log("Error in buy transaction");
                            throw new Error("Error in buy transaction");
                        }
                        const result = yield buy(srcKp, baseMint, buyAmountSecond);
                        if (result) {
                            break;
                        }
                        else {
                            l++;
                            yield (0, utils_1.sleep)(2000);
                        }
                    }
                    catch (error) {
                        l++;
                    }
                }
                yield (0, utils_1.sleep)(SELL_WAIT_INTERVAL * 1000);
                // try selling until success
                let j = 0;
                while (true) {
                    if (j > 10) {
                        console.log("Error in sell transaction");
                        return;
                    }
                    const result = yield sell(baseMint, srcKp);
                    if (result) {
                        break;
                    }
                    else {
                        j++;
                        yield (0, utils_1.sleep)(2000);
                    }
                }
                // SOL transfer part
                const balance = yield exports.solanaConnection.getBalance(srcKp.publicKey);
                let k = 0;
                while (true) {
                    try {
                        if (k > 3) {
                            console.log("Failed to transfer SOL to new wallet in one of sub wallet");
                            return;
                        }
                        const baseAta = (0, spl_token_1.getAssociatedTokenAddressSync)(baseMint, srcKp.publicKey);
                        const tx = new web3_js_1.Transaction().add(web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000000 }), web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({ units: 10000 }), (0, spl_token_1.createCloseAccountInstruction)(baseAta, exports.mainKp.publicKey, srcKp.publicKey), web3_js_1.SystemProgram.transfer({
                            fromPubkey: srcKp.publicKey,
                            toPubkey: exports.mainKp.publicKey,
                            lamports: balance
                        }));
                        tx.feePayer = exports.mainKp.publicKey;
                        tx.recentBlockhash = (yield exports.solanaConnection.getLatestBlockhash()).blockhash;
                        const sig = yield (0, web3_js_1.sendAndConfirmTransaction)(exports.solanaConnection, tx, [srcKp, exports.mainKp], { skipPreflight: true, commitment: "confirmed" });
                        console.log(`Gathered SOL back to main wallet, https://solscan.io/tx/${sig}`);
                        // filter the keypair that is completed (after this procedure, only keypairs with sol or ata will be saved in data.json)
                        const walletsData = (0, utils_1.readJson)();
                        const wallets = walletsData.filter(({ privateKey }) => bs58_1.default.encode(srcKp.secretKey) != privateKey);
                        (0, utils_1.saveNewFile)(wallets);
                        break;
                    }
                    catch (error) {
                        console.log("Error in gather ");
                        k++;
                    }
                }
            }));
            yield (0, utils_1.sleep)(interval);
        }
        catch (error) {
            console.log("Error in one of the steps");
        }
    }
});
const distributeSol = (connection, mainKp, distritbutionNum) => __awaiter(void 0, void 0, void 0, function* () {
    const data = [];
    const wallets = [];
    try {
        const sendSolTx = [];
        sendSolTx.push(web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000000 }), web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({ units: 12000 }));
        const mainSolBal = yield connection.getBalance(mainKp.publicKey);
        if (mainSolBal <= 8 * 10 ** 6 * constants_1.DISTRIBUTE_WALLET_NUM) {
            console.log("Main wallet balance is not enough");
            return [];
        }
        let solAmount = Math.floor(constants_1.SOL_AMOUNT_TO_DISTRIBUTE * 10 ** 9 / distritbutionNum);
        for (let i = 0; i < distritbutionNum; i++) {
            const wallet = web3_js_1.Keypair.generate();
            let lamports = Math.floor(solAmount * (1 - (Math.random() * 0.2)));
            wallets.push({ kp: wallet, buyAmount: solAmount });
            sendSolTx.push(web3_js_1.SystemProgram.transfer({
                fromPubkey: mainKp.publicKey,
                toPubkey: wallet.publicKey,
                lamports
            }));
        }
        wallets.map((wallet) => {
            data.push({
                privateKey: bs58_1.default.encode(wallet.kp.secretKey),
                pubkey: wallet.kp.publicKey.toBase58(),
            });
        });
        try {
            (0, utils_1.saveDataToFile)(data);
        }
        catch (error) {
            console.log("DistributeSol tx error");
        }
        try {
            const siTx = new web3_js_1.Transaction().add(...sendSolTx);
            const latestBlockhash = yield exports.solanaConnection.getLatestBlockhash();
            siTx.feePayer = mainKp.publicKey;
            siTx.recentBlockhash = latestBlockhash.blockhash;
            const messageV0 = new web3_js_1.TransactionMessage({
                payerKey: mainKp.publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: sendSolTx,
            }).compileToV0Message();
            const transaction = new web3_js_1.VersionedTransaction(messageV0);
            transaction.sign([mainKp]);
            let txSig;
            if (constants_1.JITO_MODE) {
                txSig = yield (0, jito_1.executeJitoTx)([transaction], mainKp, jitoCommitment);
            }
            else {
                txSig = yield (0, legacy_1.execute)(transaction, latestBlockhash, 1);
            }
            if (txSig) {
                const distibuteTx = txSig ? `https://solscan.io/tx/${txSig}` : '';
                console.log("SOL distributed ", distibuteTx);
            }
        }
        catch (error) {
            console.log("Distribution error");
            return null;
        }
        console.log("Success in distribution");
        return wallets;
    }
    catch (error) {
        console.log(`Failed to transfer SOL`);
        return null;
    }
});
const buy = (newWallet, baseMint, buyAmount) => __awaiter(void 0, void 0, void 0, function* () {
    let solBalance = 0;
    try {
        solBalance = yield exports.solanaConnection.getBalance(newWallet.publicKey);
    }
    catch (error) {
        console.log("Error getting balance of wallet");
        return null;
    }
    if (solBalance == 0) {
        return null;
    }
    try {
        let buyTx = yield (0, swapOnlyAmm_1.getBuyTxWithJupiter)(newWallet, baseMint, buyAmount);
        if (buyTx == null) {
            console.log(`Error getting buy transaction`);
            return null;
        }
        let txSig;
        if (constants_1.JITO_MODE) {
            txSig = yield (0, jito_1.executeJitoTx)([buyTx], exports.mainKp, jitoCommitment);
        }
        else {
            const latestBlockhash = yield exports.solanaConnection.getLatestBlockhash();
            txSig = yield (0, legacy_1.execute)(buyTx, latestBlockhash, 1);
        }
        if (txSig) {
            const tokenBuyTx = txSig ? `https://solscan.io/tx/${txSig}` : '';
            console.log("Success in buy transaction: ", tokenBuyTx);
            return tokenBuyTx;
        }
        else {
            return null;
        }
    }
    catch (error) {
        console.log("Buy transaction error");
        return null;
    }
});
const sell = (baseMint, wallet) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = (0, utils_1.readJson)();
        if (data.length == 0) {
            yield (0, utils_1.sleep)(1000);
            return null;
        }
        const tokenAta = yield (0, spl_token_1.getAssociatedTokenAddress)(baseMint, wallet.publicKey);
        const tokenBalInfo = yield exports.solanaConnection.getTokenAccountBalance(tokenAta);
        if (!tokenBalInfo) {
            console.log("Balance incorrect");
            return null;
        }
        const tokenBalance = tokenBalInfo.value.amount;
        try {
            let sellTx = yield (0, swapOnlyAmm_1.getSellTxWithJupiter)(wallet, baseMint, tokenBalance);
            if (sellTx == null) {
                console.log(`Error getting buy transaction`);
                return null;
            }
            let txSig;
            if (constants_1.JITO_MODE) {
                txSig = yield (0, jito_1.executeJitoTx)([sellTx], exports.mainKp, jitoCommitment);
            }
            else {
                const latestBlockhash = yield exports.solanaConnection.getLatestBlockhash();
                txSig = yield (0, legacy_1.execute)(sellTx, latestBlockhash, 1);
            }
            if (txSig) {
                const tokenSellTx = txSig ? `https://solscan.io/tx/${txSig}` : '';
                console.log("Success in sell transaction: ", tokenSellTx);
                return tokenSellTx;
            }
            else {
                return null;
            }
        }
        catch (error) {
            console.log("Sell transaction error");
            return null;
        }
    }
    catch (error) {
        return null;
    }
});
main();
