require("dotenv").config();
const http = require('http');
const express = require('express');
const { ConnectDB } = require("./lib/database")
const { initMediasoupWorker } = require('./src/mediasoup');
const store = require('./src/store');
const initSocket = require('./src/socket');
const cors = require('cors');
const router = require('./src/routes');
const formidableMiddleware = require('express-formidable');

const InitializeServer = async () => {
  const expressServer = new express();
  const server = http.createServer(expressServer);
  store.app = expressServer;
  await initSocket(server);
  await initMediasoupWorker();

  const { app } = store;
  app.use(cors());
  app.use(formidableMiddleware());
  app.use('/api', router);

  const listenServer = () => server.listen(process.env.PORT, async () => {
    console.log(`✅ Server listening on port ${process.env.PORT}`);
    await ConnectDB();
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

  listenServer();
}

InitializeServer();