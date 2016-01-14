const Router = require('./router');
const routes = require('./routes');
const Ru = require('@panosoft/ramda-utils');
const Server = require('./server');

const create = (config) => {
  config = Ru.defaults({
    key: null,
    cert: null,
    log: null
  }, config);
  const router = Router.create({ log: config.log }, routes);
  const server = Server.create(config, router.route);
  return server;
};

module.exports = { create };
