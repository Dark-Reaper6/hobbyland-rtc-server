require("dotenv").config();
const http = require('http');
const express = require('express');
const { ConnectDB } = require("./lib/database")
const { initMediasoupWorker } = require('./src/mediasoup');
const store = require('./src/store');
const initSocket = require('./src/socket');
const Config = require('./config');
const cors = require('cors');
const router = require('./routes');
const formidableMiddleware = require('express-formidable');

const expressServer = new express();
const server = http.createServer(expressServer);
store.app = expressServer;
store.config = Config;
initSocket(server);
initMediasoupWorker();

store.app.use(cors());
store.app.use(formidableMiddleware());
store.app.use('/api', router);

const listen = () => server.listen(process.env.PORT, async () => {
  console.log(`Server listening on port ${process.env.PORT}`)
  await ConnectDB()
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('Specified port unavailable, retrying in 10 seconds...');
    setTimeout(() => {
      server.close();
      server.listen();
    }, process.env.RETRY_INTERVAL);
  }
});

listen();