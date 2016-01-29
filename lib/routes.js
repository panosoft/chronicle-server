const run = require('./run');

const routes = {
  '/': { POST: run }
};
module.exports = routes;
