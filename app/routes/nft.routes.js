const controller = require("../controllers/nft.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
        "Access-Control-Allow-Headers",
        "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  /* Upload NFT to TERNOA chain */
  app.post("/api/createNFT", controller.createNft);

  /* Sell NFT to TERNOA Market Place */
  app.post("/api/sellNFT", controller.sellNFT);
};
