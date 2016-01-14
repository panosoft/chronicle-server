const https = require('https');
const Ru = require('@panosoft/ramda-utils');

const create = (options, route) => {
  options = Ru.defaults({
    key: null,
    cert: null
  }, options);
  if (!options.key) throw new TypeError(`key must be defined`);
  if (!options.cert) throw new TypeError(`cert must be defined`);

  const server = https.createServer(options, route);
  const address = server.address.bind(server);
  const close = () => new Promise((resolve) => server.close((error) => resolve()));
  const connections = () => new Promise((resolve, reject) =>
    server.getConnections((error, count) => error ? reject(error) : resolve(count)
  ));
  const listen = function () {
    const args = Array.from(arguments);
    return new Promise((resolve, reject) => {
      args.push((error) => error ? reject(error) : resolve());
      server.listen.apply(server, args);
    });
  };

  return { address, close, connections, listen };
};

module.exports = { create };
