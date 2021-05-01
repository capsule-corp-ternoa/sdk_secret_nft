const controller = require("../controllers/sia.controller");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    /* Encrypt file using key and send file to Sia server */
    app.post("/api/cryptFile", controller.cryptFile);

    /* Upload images to SIA server */
    app.post("/api/uploadIM", controller.uploadIM);

    /* Upload JSON file to SIA server */
    app.post("/api/uploadEX", controller.uploadEX);
};