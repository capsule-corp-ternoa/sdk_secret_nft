/* General libraries */
const fs = require('fs');
const path = require('path');
const openpgp = require("openpgp");
var AdmZip = require('adm-zip');

/* Polkadot libraries */
const { mnemonicGenerate, blake2AsHex } = require('@polkadot/util-crypto');
const { Keyring } = require('@polkadot/keyring');

/* Sia libraries */
const { SkynetClient } = require('@nebulous/skynet');
const client = new SkynetClient();

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

const { generateKey } = require('../helpers/helpers');

/* Generate mnemonic, public address and return random account details */
exports.mnemonicGenerate = 
  async (req, res) => {

    try {
      const keyring = new Keyring({ type: 'sr25519' });
      const mnemonic = mnemonicGenerate();
      const newAccount = await keyring.addFromUri(mnemonic);
      let account = {
        mnemonic: mnemonic,
        address: newAccount.address,
      };
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(account));
    } catch (err) {
      res.status(404).send(err.message);
    }
};

/* Generate Asymmetric GPG Keys */
exports.downloadKey = 
  async (req, res) => {

  /* clean Keys Folders */
  if (fs.existsSync('./keys/keys.zip')) { fs.unlinkSync('./keys/keys.zip') };
  if (fs.existsSync('./keys/password.txt')) { fs.unlinkSync('./keys/password.txt'); }
  if (fs.existsSync('./keys/public.txt')) { fs.unlinkSync('./keys/public.txt'); }
  if (fs.existsSync('./keys/private.txt')) { fs.unlinkSync('./keys/private.txt'); }
  if (fs.existsSync('./keys/_revokekey.txt')) { fs.unlinkSync('./keys/_revokekey.txt'); }

  AWS.config.update({
    accessKeyId: process.env.accessKeyId,
    secretAccessKey: process.env.secretAccessKey
  });

  var s3 = new AWS.S3();

  var params = {
    Key: process.env.bucketFile,
    Bucket: process.env.bucketName
  }

  s3.getObject(params, function (err, data) {
    if (err) {
      throw err;
    }

    fs.writeFileSync('./keys/keys.zip', data.Body);

    var zip = new admZip("./keys/keys.zip");

    zip.extractAllTo("./keys", true);

    res.setHeader('Content-Type', 'application/json');

    res.json('ok');
  });
};

/* generate pgp Key */
exports.generateKey = 
  async (req, res) => {

    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;

    for (var i = 0; i < 20; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    try {

      const hash = await blake2AsHex(result);

      const { 
        privateKeyArmored, 
        publicKeyArmored, 
        revocationCertificate 
      } = await openpgp.generateKey({
        type: 'ecc',
        curve: 'curve25519',
        userIds: [
          { 
            name: 'yourname', 
            email: 'johndoe@ternoa.com' 
          }
        ],
        passphrase: hash
      });

      if (fs.existsSync('./keys/private.txt')) {
        res.json("keys already created");
      } else {
        
        /* Delete existing files */
        if (fs.existsSync('./keys/keys.zip')) { fs.unlinkSync('./keys/keys.zip') };
        if (fs.existsSync('./keys/password.txt')) { fs.unlinkSync('./keys/password.txt'); }
        if (fs.existsSync('./keys/public.txt')) { fs.unlinkSync('./keys/public.txt'); }
        if (fs.existsSync('./keys/private.txt')) { fs.unlinkSync('./keys/private.txt'); }
        if (fs.existsSync('./keys/_revokekey.txt')) { fs.unlinkSync('./keys/_revokekey.txt'); }

        /* Safe encrypted NFT keys*/

        fs.writeFileSync('./keys/private.txt', privateKeyArmored); /* GPG PRIVATE KEY */

        fs.writeFileSync('./keys/password.txt', hash); /* GPG PRIVATE KEY PASSWORD */
        
        fs.writeFileSync('./keys/public.txt', publicKeyArmored); /* PGP PUBLIC KEY */

        fs.writeFileSync('./keys/_revokekey.txt', revocationCertificate);  /* GPG REVOKE KEY */
        
        const skylink = await client.uploadFile('./keys/public.txt'); /* share public key */

        /* GPG REVOKE KEY */
        fs.writeFileSync('./keys/sharedUrl.txt', `https://siasky.net/${skylink.substring(6)}`); 

        /* Backup S3 (only on DEV) */
        var randomkey = generateKey(32);
        var zip = new AdmZip();
        zip.addLocalFile('./keys/private.txt');
        zip.addLocalFile('./keys/password.txt');
        zip.addLocalFile('./keys/public.txt');
        zip.addLocalFile('./keys/_revokekey.txt');
        zip.toBuffer();
        zip.writeZip('./keys/' + randomkey + '_keys.zip');

        AWS.config.update({
          accessKeyId: process.env.accessKeyId,
          secretAccessKey: process.env.secretAccessKey
        });

        var s3 = new AWS.S3();

        var filePath = './keys/' + randomkey + '_keys.zip';

        var params = {
          Bucket: 'node1.keys',
          Body: fs.createReadStream(filePath),
          Key: "keys/" + path.basename(filePath)
        };

        s3.upload(params, function (err, data) {
          if (err) {
            console.log('Error', err);
          }

          if (data) {
            console.log('Uploaded in:', data.Location);
          }
        });

        /* Return random password for decrypt KEY */
        res.setHeader('Content-Type', 'application/json');

        res.send(JSON.stringify({
          'url': `https://siasky.net/${skylink.substring(6)}`
        }));
      }
    } catch (err) {
      res.status(404).send(err.message);
    }
};