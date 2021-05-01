/* General libraries */
const fs = require('fs');
var AdmZip = require('adm-zip');

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

const { getChecksum, generateKey } = require('../helpers/helpers');
  
/* Encrypt Symetric */
exports.cryptFile = 
  async (req, res) => {
    const file = req.files.file;

    file.mv('./tmp/' + file.name, async function (err, result) {
      if (err) {
        throw err;
      }

      /* source file path */
      let filePath = './tmp/' + file.name; 

      /* Generate Secret Key */
      var ENCRYPTION_KEY = generateKey(32);

      /* unique original hash of file */
      var hashFile = await getChecksum(filePath); 
      const IV_LENGTH = 16;
      let iv = crypto.randomBytes(IV_LENGTH);

      /* write secret Key on localStorate */
      fs.writeFileSync('./nftkeys/' + hashFile + '.key', ENCRYPTION_KEY + ':' + iv.toString('hex')); 

      /* encrypt */
      let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
      var input = fs.createReadStream(filePath);

      /* write encrypted File */
      var output = fs.createWriteStream('./tmp/' + hashFile + '_' + file.name + '.ternoa'); 
      input.pipe(cipher).pipe(output);

      output.on('finish', function () {
        var zip = new AdmZip();
        zip.addLocalFile('./tmp/' + hashFile + '_' + file.name + '.ternoa');
        zip.toBuffer();
        zip.writeZip('./tmp/' + hashFile + '_' + file.name + '.ternoa.zip');

        try {
            const skylink = await client.uploadFile('./tmp/' + hashFile + '_' + file.name + '.ternoa.zip');
            res.json(
              {
                file: `https://siasky.net/${skylink.substring(6)}`, /* Encrypted secret hosted on Skynet */
                hashfile: hashFile /* hash of orginal file for search purpose */
              }
            );

            /* Clean tmp folder */
            fs.unlinkSync(filePath);
            fs.unlinkSync('./tmp/' + hashFile + '_' + file.name + '.ternoa');
            fs.unlinkSync('./tmp/' + hashFile + '_' + file.name + '.ternoa.zip');
        } catch (err) {
          res.status(404).send(err.message);
        }
      });
    });
};

/* Upload image to Sia */
exports.uploadIM = 
  async (req, res) => {
    const file = req.files.file;
    file.mv('./uploads/' + file.name, async function (err, result) {
      if (err) throw err;

      try {
        const skylink = await client.uploadFile('./uploads/' + file.name); /* uploading */
        res.json({ file: `https://siasky.net/${skylink.substring(6)}` });
      } catch (err) {
        res.status(404).send(err.message);
      }
    });
};

/* Generate and upload NFT to SIA */
exports.uploadEX = 
  async (req, res) => {
    const { internalId, name, descripion, media, mediaType, cryptedMedia, cryptedMediaType, hash } = req.body;
    let modifiedData = {
      internalId, /* Unused for now */
      name, /* NFT name */
      hash, /* hash original file */
      descripion, /* NFT description */
      media: { /* Media */
        url: media,
        mediaType: mediaType
      },
      cryptedMedia: { /* secret */
        url: cryptedMedia,
        cryptedMediaType: cryptedMediaType
      }
    }

    try {
      /* generate temporary name */
      var jsonName = generateKey(32); 
      fs.writeFileSync('./tmp/' + jsonName + '.json', JSON.stringify(modifiedData));

      /* generate and upload Json file */
      const skylink = await client.uploadFile('./tmp/' + jsonName + '.json');
      res.json({ file: `https://siasky.net/${skylink.substring(6)}` });
      fs.unlinkSync('./tmp/' + jsonName + '.json');
    } catch (err) {
      res.status(404).send(err.message);
    }
};