require("dotenv").config();
const express = require('express');
const { ConnectDB } = require("./lib/database")
const app = express();
const http = require('http');
const io = require('socket.io');
const store = require('./src/store');
const initSocket = require('./src/socket');
const mediasoup = require('./src/mediasoup');
const Config = require('./config');

const server = http.createServer(app);
store.app = app;
store.config = Config;
store.io = io(server);
initSocket();
mediasoup.init();

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