const chronicle = require('@panosoft/chronicle');
const co = require('co');
const is = require('is_js');
const mime = require('mime-types');
const parse = require('co-body');

const validateHeaders = (headers) => {
  const supportedMimeType = mime.lookup('json');
  if (headers['content-type'] !== supportedMimeType) {
    throw new TypeError(`request content-type must be ${supportedMimeType}`);
  }
};
const validateBody = (body) => {
  const prefix = 'Invalid request:';
  if (!is.json(body)) throw new TypeError(`${prefix} body must be an object.`);
  if (!body.report) throw new TypeError(`${prefix} report field must be defined.`);
  if (!is.string(body.report)) throw new TypeError(`${prefix} report field must be a string.`);
};
const run = co.wrap(function * (request, response, log) {
  // validate request
  validateHeaders(request.headers);
  const body = yield parse(request);
  validateBody(body);

  // run report
  log('info', { body }, 'Running report ...');
  const result = yield chronicle.run(body.report, body.parameters);
  log('info', { body }, 'Report ran.');
  response.writeHead(200, { 'content-type': mime.lookup('json') });
  response.end(JSON.stringify({ result }));
});

const routes = {
  '/': { POST: run }
};

module.exports = routes;
