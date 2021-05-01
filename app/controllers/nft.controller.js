/* Polkadot libraries */
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const { Keyring } = require('@polkadot/keyring');

/* Ternoa libraries */
const { spec } = require('../types')
const ENDPOINT = 'wss://rpc.dev.chaos.ternoa.com';

/* Crypto libraries */
const crypto = require('crypto');
const keyLength = 32;
const password = '1234';
const salt = crypto.randomBytes(32);
crypto.randomBytes(16);
crypto.scryptSync(password, salt, keyLength);

/* AWS */
const AWS = require('aws-sdk');
AWS.config.update({ region: 'eu-central-1' });

/* Mint NFT on Ternoa Chain */
exports.createNft = 
  async (req, res) => {
    /* Method for create NFT using Mnemonic */
    const { nftUrl } = req.body;

    await cryptoWaitReady();

    const keyring = new Keyring({ type: 'sr25519' });
    const user = keyring.addFromMnemonic((process.env.mnemonic));

    const wsProvider = new WsProvider(ENDPOINT);
    const api = await ApiPromise.create({ 
                        provider: wsProvider, 
                        types: spec 
                      });

    /* construct transaction to be batched */
    const transactionsToBeBatchedSent = [];

    transactionsToBeBatchedSent.push(api.tx.nfts
      .create({
        offchain_uri: nftUrl,
      })
    );

    try {
      let nftId = '';
      /* Time to trigger the tx */
      await api.tx.utility
        .batch(transactionsToBeBatchedSent)
        .signAndSend(user, 
          ({ events = [], status }) => {
            if (status.isRetracted) {
              setTimeout(() => { process.exit(1) }, 300 * 1000);
            } else if (status.isInBlock) {
              
              blockHash = status.asInBlock.toHex();

              events.forEach(({ event: { data, method, section }, phase }) => {
                if (`${section}.${method}` === 'nfts.Created') {
                  nftId = data[0].toString();
                  console.log("nftId from create", nftId)
                }
              });

            } else if (status.isFinalized) {
              return res.send(nftId);
            }
        });
    } catch (err) {
      res.status(404).send(err.message);
    }
};

/* Sell NFT on Market Place */
exports.sellNFT = 
  async (req, res) => {
    const { nftId } = req.body;

    try {
      await cryptoWaitReady();
      const keyring = new Keyring({ type: 'sr25519' });
      const user = keyring.addFromMnemonic((process.env.mnemonic));
      const wsProvider = new WsProvider(ENDPOINT);
      const api = await ApiPromise.create({ provider: wsProvider, types: spec });
      await api.tx.marketplace.list(Number(nftId), '1000000000000000000').signAndSend(user, 
        () => {
          res.send('OK');
        }
      );
    } catch (err) {
      res.status(404).send(err.message);
    }
};