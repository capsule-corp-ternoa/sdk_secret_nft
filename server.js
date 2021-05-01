const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const empty = require('empty-folder');
const app = express();
require('dotenv').config();

/* clean Folder in case of dev purpose */
const args = process.argv.slice(2)
if (args[0] == "dev") {
  empty('./zip', false, (o) => { });
  empty('./nftkeys', false, (o) => { });
  empty('./tosgx', false, (o) => { });
  empty('./uploads', false, (o) => { });
  empty('./txtkeys', false, (o) => { });
  empty('./tmp', false, (o) => { });
  empty('./storage', false, (o) => { });
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(fileUpload());

app.get('/', (req, res) => {
  res.send('server is running');
});

require("./app/routes/key.routes")(app);
require("./app/routes/sia.routes")(app);
require("./app/routes/nft.routes")(app);
require("./app/routes/signature.routes")(app);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});