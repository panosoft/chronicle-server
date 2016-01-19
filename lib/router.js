const co = require('co');
const Log = require('./log');
const mime = require('mime-types');
const R = require('ramda');
const Ru = require('@panosoft/ramda-utils');
const serialize = require('./serialize');
const url = require('url');
const uuid = require('uuid');

/**
 * @param config
 *        { log: Bunyan Logger }
 * @param routes
 *        { <pathname>: { <method>: function }}
 */
const create = (config, routes) => {
  config = Ru.defaults({ logger: null }, config);
  routes = routes || {};
  const log = Log(config.logger);

  const notFound = (request, response) => {
    const pathname = url.parse(request.url).pathname;
    const error = new Error(`${pathname} not found`);
    log('error', { request: serialize(request), error: serialize(error) }, 'Not found.');
    response.writeHead(404, { 'content-type': mime.lookup('json') });
    response.end(JSON.stringify({ error: error.message }));
  };
  const methodNotAllowed = (request, response) => {
    const pathname = url.parse(request.url).pathname;
    const allow = R.join(',', R.keys(routes[pathname]));
    const error = new Error(`${request.method} not allowed for ${pathname}`);
    log('error', { request: serialize(request), error: serialize(error) }, 'Method not allowed.');
    response.writeHead(405, { 'content-type': mime.lookup('json'), allow });
    response.end(JSON.stringify({ error: error.message }));
  };
  const internalServerError = (request, response, error) => {
    log('error', { request: serialize(request), error: serialize(error) }, 'Internal server error.');
    response.writeHead(500, { 'content-type': mime.lookup('json') });
    response.end(JSON.stringify({ error: error.message }));
  };

  const route = co.wrap(function * (request, response) {
    request.id = uuid.v4();
    log('info', { request: serialize(request) }, 'Request received.');
    response.on('finish', () =>
      log('info', { request: serialize(request), response: serialize(response) }, 'Response sent.')
    );
    const pathname = url.parse(request.url).pathname;
    const method = request.method;
    try {
      if (!routes[pathname]) notFound(request, response);
      else if (!routes[pathname][method]) methodNotAllowed(request, response);
      else yield Promise.resolve(routes[pathname][method](request, response, log));
    }
    catch (error) { internalServerError(request, response, error); }
  });
  return { route };
};

module.exports = { create };
