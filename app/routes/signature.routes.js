const controller = require("../controllers/signature.controller");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    /* Send signature to Server */
    app.post("/api/sgxEnpoint", controller.sgxEnpoint);

    /* Generate Signature and crypt for SGX enclave */
    app.post("/api/signPasswordRequest", controller.signPasswordRequest);
    
    /* Generate Get request Signature */
    app.post("/api/sgxRequestPasswordSign", controller.sgxRequestPasswordSign);

    /* Get signature to Server */
    app.post("/api/sgxRequestPassword", controller.sgxRequestPassword);
    
    /* Asking to server the public key */
    app.post("/api/servePublicKey", controller.servePublicKey);
    
    /* Share my Key */
    app.get("/api/shareMyKey", controller.shareMyKey);
};