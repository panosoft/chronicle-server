const routes = require('./routes');
const Server = require('./server');

const create = (options) => Server.create(options, routes);
module.exports = { create };
