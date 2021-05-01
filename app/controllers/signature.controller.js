/* General libraries */
const fs = require('fs');
const path = require('path');
const openpgp = require("openpgp");
const request = require('superagent');

/* Sia libraries */
const { SkynetClient } = require('@nebulous/skynet');
const client = new SkynetClient();

/* Polkadot libraries */
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { u8aToHex } = require('@polkadot/util');
const { signatureVerify, cryptoWaitReady, decodeAddress } = require('@polkadot/util-crypto');
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

const { sleep, isValidSignature } = require('../helpers/helpers');

/* Encrypt and send NFT GPG private Key to SGX */
exports.signPasswordRequest = 
  async (req, res) => {
    const { hash, nftId } = req.body;

    try {

      await cryptoWaitReady();

      /* Connect to Wallet */
      const keyring = new Keyring({ type: 'sr25519' });
      const user = await keyring.addFromUri(process.env.mnemonic);

      /* Encrypt NFT secret */
      const node1pub = fs.readFileSync('./keys/remote.txt');

      const plainData = fs.readFileSync("./nftkeys/" + hash + ".key");

      const encrypted = await openpgp.encrypt({
                            message: openpgp.Message.fromText(plainData.toString()),
                            publicKeys: await openpgp.readKey({ 
                                            armoredKey: node1pub.toString() 
                                        })
                        });

      fs.writeFileSync('./nftkeys/' + hash + '.key.ternoa', encrypted);
      
      /* zip file */
      var zip = new AdmZip(); 
      zip.addLocalFile('./nftkeys/' + hash + '.key.ternoa');
      zip.toBuffer();
      zip.writeZip('./nftkeys/' + hash + '.zip');

      /* upload zip file to sia*/
      const skylink = await client.uploadFile('./nftkeys/' + hash + '.zip');

      /* Generate signature */
      const message = hash + '_' + user.address;
      const signature = user.sign(message);
      res.send(JSON.stringify({
        'data': message,
        'signature': u8aToHex(signature),
        'zip': `https://siasky.net/${skylink.substring(6)}`,
        'nftId': nftId
      }));
    } catch (err) {
      res.status(404).send(err.message);
    }
};

/* Used sign and send to endPoint Keys */
exports.sgxEnpoint = 
  async (req, res) => {
    const { signature, data, zip, nftId } = req.body;
    const dataContent = data.split('_');

    try {

      await cryptoWaitReady();

      /* first check if signed content is real */
      const isValid = isValidSignature(data, signature, dataContent[1]);

      if (isValid == true) {

        /* check is owner is the real owner */

        const wsProvider = new WsProvider(ENDPOINT);
        const api = await ApiPromise.create({ 
                            provider: wsProvider, 
                            types: spec 
                          });
        const nftData = await api.query.nfts.data(nftId);
        
        Buffer.from(nftData.details.offchain_uri, 'hex');

        if (nftData.owner.toString() == dataContent[1]) {

          /* Download zip and check the Hash */
          const zipFile = './zip/' + dataContent[0] + '.zip';
          const source = zip;
          request
            .get(source)
            .on('error', function (error) {
            })
            .pipe(fs.createWriteStream(zipFile))
            .on('finish', async function () {
              var zip = new admZip(zipFile);
              zip.extractAllTo("./zip", true);
              await decrypt();
              res.send(JSON.stringify("Secret registered"));
            });

          /* Save without Decrypt. @Todo: Add control of publicKey */

          /* Decrypt NFT KEY */
          async function decrypt() {

            /* BACKUP NFT KEY ON S3 (DEV PURPOSE ONLY !!!!  ) */
            AWS.config.update({
              accessKeyId: process.env.accessKeyId,
              secretAccessKey: process.env.secretAccessKey
            });

            var s3 = new AWS.S3();
            var params = {
              Key: process.env.bucketFile,
              Bucket: process.env.bucketName
            }
            var s3 = new AWS.S3();
            var filePath = './zip/' + dataContent[0] + '.key.ternoa';

            var params = {
              Bucket: 'node1.keys',
              Body: fs.createReadStream(filePath),
              Key: 'storage/' + path.basename(filePath)
            };
            console.log('ok2');
            s3.upload(params, function (err, data) {
              if (err) { console.log('Error', err); }
              if (data) { console.log('Uploaded in:', data.Location); }
            });
          };
        } else {
          res.send('nftOwner '+nftData.owner.toString()+' - Claim user '+dataContent[1]);
        }
      }
  } catch (err) {
    res.status(404).send(err.message);
  }
};

/* Used sign request NFT password */
exports.sgxRequestPasswordSign = 
  async (req, res) => {
    const { nftId, hash } = req.body;  /* Hash is secret file Hash */
    
    try {
      await cryptoWaitReady();

      /* Connect to Wallet */
      const keyring = new Keyring({ type: 'sr25519' });
      const user = await keyring.addFromUri(process.env.mnemonic);

      /* Generate signature  */
      const url = fs.readFileSync('./keys/sharedUrl.txt');
      const message = nftId + '_' + user.address + '_' + hash;
      const signature = user.sign(message);

      console.log(u8aToHex(signature));

      res.send(JSON.stringify({
        'data': message,
        'signature': u8aToHex(signature),
        'key': url.toString(),
        'nftId': nftId
      }));
    } catch (err) {
      res.status(404).send(err.message);
    }
};

/* Return NFT secret key crypted with onwer GPG public key */
exports.sgxRequestPassword = 
  async (req, res) => {
    const { signature, data, key } = req.body;
    const dataContent = data.split('_');

    try {

      /* Load Keys for decrypt NFT secret Key */
      const node1priv = fs.readFileSync('./keys/private.txt');
      const node1passwd = fs.readFileSync('./keys/password.txt');

      await cryptoWaitReady();

      /* first check if signed content is real  */
      const isValidSignature = (
        signedMessage, signature, address) => {
        const publicKey = decodeAddress(address);
        const hexPublicKey = u8aToHex(publicKey);
        return signatureVerify(signedMessage, signature, hexPublicKey).isValid;
      };

      const isValid = isValidSignature(data, signature, dataContent[1]);

      if (isValid == true) {

        /* check is owner is the real owner */
        const wsProvider = new WsProvider(ENDPOINT);
        const api = await ApiPromise.create({ provider: wsProvider, types: spec });
        const nftData = await api.query.nfts.data(dataContent[0]);
        Buffer.from(nftData.details.offchain_uri, 'hex');

        if (nftData.owner.toString() == dataContent[1]) {
          
          /*Getting from AWS (only for dev .env) NFT secret key encrypted*/ 
          AWS.config.update({
            accessKeyId: process.env.accessKeyId,
            secretAccessKey: process.env.secretAccessKey
          });

          /* Download the key */
          var s3 = new AWS.S3();
          var params = {
            Key: 'storage/' + dataContent[2] + '.key.ternoa',
            Bucket: process.env.bucketName
          }
          
          s3.getObject(params, function (err, data) {
            if (err) {
              throw err
            }
            fs.writeFileSync('./zip/' + dataContent[2] + '.key.ternoa', data.Body);
          });

          await sleep(1000);

          /* decrypt the NFT keys */
          const privateKey = await openpgp.readKey({ 
                                      armoredKey: node1priv.toString() 
                                    });

          await privateKey.decrypt(node1passwd);

          const encryptedData = fs.readFileSync("./zip/" + dataContent[2] + ".key.ternoa");

          const decrypted = await openpgp.decrypt({
            message: await openpgp.readMessage({ armoredMessage: encryptedData }),
            privateKeys: [privateKey]
          });

          /* get and store NFT owner public key */
          const file = fs.createWriteStream('./zip/public.txt');

          /* encrypt nft secret key using owner public key and return */
          https.get(key, response => {
            response.pipe(file).on('finish', async function () {
              const pkey = fs.readFileSync('./zip/public.txt');
              const plainData = fs.readFileSync('./zip/public.txt');
              const encrypted = await openpgp.encrypt({
                message: openpgp.Message.fromText(decrypted.data),
                publicKeys: await openpgp.readKey({ armoredKey: pkey.toString() })
              });

              res.setHeader('Content-Type', 'text/plain');
              res.send(encrypted);

            })
          });
        } else{
          console.log('nftOwner ' +nftData.owner.toString()+' - Claim user '+dataContent[1]);
          res.send('nftOwner ' +nftData.owner.toString()+' - Claim user '+dataContent[1]);
        }
      }
  } catch (err) {
    res.status(404).send(err.message);
  }
};

/* Show Node public Key */
exports.servePublicKey = async (req, res) => {
    res.send(JSON.stringify({
      'url': process.env.publicKey
    }));
};

/* Share my public Key */
exports.shareMyKey = 
  async (req, res) => {
    try {
      /* share public key */
      const skylink = await client.uploadFile("./keys/public.txt");

      /* GPG REVOKE KEY */
      fs.writeFileSync('./keys/sharedUrl.txt', `https://siasky.net/${skylink.substring(6)}`); 

      /* Return random password for decrypt KEY */
      res.setHeader('Content-Type', 'application/json');

      res.send(JSON.stringify({
        'url': `https://siasky.net/${skylink.substring(6)}`
      }));
    } catch (err) {
      res.status(404).send(err.message);
    }
};