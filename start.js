// Wrapper to patch the HTTP server to disable keep-alive
const http = require('http');
const originalCreateServer = http.createServer;

http.createServer = function(...args) {
  const server = originalCreateServer.apply(this, args);
  // Set keepAliveTimeout to 0 to close connections immediately
  server.keepAliveTimeout = 0;
  // Also patch the listener to add Connection: close header
  const originalOn = server.on.bind(server);
  originalOn('request', (req, res) => {
    res.setHeader('Connection', 'close');
  });
  return server;
};

// Now require the actual server
require('./server.js');
