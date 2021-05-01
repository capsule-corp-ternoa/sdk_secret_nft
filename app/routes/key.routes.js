const controller = require("../controllers/key.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  /* Generate mnemonic and public address */
  app.get("/api/mnemonicGenerate", controller.mnemonicGenerate);

  /* Generate key for protect Secret */
  app.get("/api/generateKey", controller.generateKey);
  
  /* Download key */
  app.get("/api/downloadKey", controller.downloadKey);
};
