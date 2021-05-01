/* General libraries */
const fs = require('fs');

/* Crypto libraries */
const crypto = require('crypto');
const keyLength = 32;
const password = '1234';
const salt = crypto.randomBytes(32);
crypto.randomBytes(16);
crypto.scryptSync(password, salt, keyLength);

/* Polkadot libraries */
const { u8aToHex } = require('@polkadot/util');
const { signatureVerify, decodeAddress } = require('@polkadot/util-crypto');

function generateKey(lengthChr) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < lengthChr; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return (result);
};

function getChecksum(path) {
    return new Promise(function (resolve, reject) {
      const hash = crypto.createHash('sha256');
      const input = fs.createReadStream(path);
  
      input.on('error', reject);
  
      input.on('data', function (chunk) {
        hash.update(chunk);
      });
  
      input.on('close', function () {
        resolve(hash.digest('hex'));
      });
    });
};

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
};  
  
const isValidSignature = (
    signedMessage, signature, address) => {
    const publicKey = decodeAddress(address);
    const hexPublicKey = u8aToHex(publicKey);
    return signatureVerify(signedMessage, signature, hexPublicKey).isValid;
};

module.exports = {
    generateKey,
    getChecksum,
    sleep,
    isValidSignature
};