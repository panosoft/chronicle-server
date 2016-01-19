const Router = require('./router');
const routes = require('./routes');
const Ru = require('@panosoft/ramda-utils');
const Server = require('./server');

const create = (config) => {
  config = Ru.defaults({
    key: null,
    cert: null,
    logger: null
  }, config);
  const router = Router.create({ logger: config.logger }, routes);
  const server = Server.create(config, router.route);
  return server;
};

module.exports = { create };
