const chronicle = require('@panosoft/chronicle');
const co = require('co');
const is = require('is_js');
const mime = require('mime-types');
const parse = require('co-body');
const serialize = require('./serialize');

const run = co.wrap(function * (request, response, log) {
  const unsupportedMediaType = (request, response, supportedMimeType) => {
    const error = new TypeError(`request content-type must be ${supportedMimeType}`);
    log('error', { request: serialize(request), error: serialize(error) }, 'Unsupported media type.');
    response.writeHead(415, { 'content-type': mime.lookup('json') });
    response.end(JSON.stringify({ error: error.message }));
  };
  const badRequest = (request, response, error) => {
    log('error', { request: serialize(request), error: serialize(error) }, 'Bad request.');
    response.writeHead(400, { 'content-type': mime.lookup('json') });
    response.end(JSON.stringify({ error: error.message }));
  };
  const validate = (body) => {
    const prefix = 'Invalid request:';
    if (!is.json(body)) throw new TypeError(`${prefix} body must be an object.`);
    if (!body.report) throw new TypeError(`${prefix} report field must be defined.`);
    if (!is.string(body.report)) throw new TypeError(`${prefix} report field must be a string.`);
  };

  // validate request
  const supportedMimeType = mime.lookup('json');
  const contentType = request.headers['content-type'];
  if (contentType !== supportedMimeType) {
    return unsupportedMediaType(request, response, supportedMimeType);
  }

  // validate body
  const body = yield parse(request);
  try { validate(body); }
  catch (error) { return badRequest(request, response, error); }
  
  // run report
  log('info', { request: serialize(request), body }, 'Running report ...');
  const result = yield chronicle.run(body.report, body.parameters);
  log('info', { request: serialize(request), body }, 'Report ran.');
  response.writeHead(200, { 'content-type': mime.lookup('json') });
  response.end(JSON.stringify({ result }));
});

const routes = {
  '/': { POST: run }
};

module.exports = routes;
