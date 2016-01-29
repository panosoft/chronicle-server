const chronicle = require('@panosoft/chronicle');
const co = require('co');
const is = require('is_js');
const mime = require('mime-types');
const parse = require('co-body');

const validateHeaders = (headers) => {
  const supportedMimeType = mime.lookup('json');
  if (headers['content-type'] !== supportedMimeType) {
    throw new TypeError(`Invalid request: header: request content-type must be ${supportedMimeType}`);
  }
};
const validateBody = (body) => {
  const prefix = 'Invalid request: body:';
  if (!is.json(body)) throw new TypeError(`${prefix} must be an object.`);
  if (!body.report) throw new TypeError(`${prefix} report field must be defined.`);
  if (!is.string(body.report)) throw new TypeError(`${prefix} report field must be a string.`);
};
const run = co.wrap(function * (request, response, log) {
  validateHeaders(request.headers);
  const body = yield parse(request);
  validateBody(body);
  log('info', { body }, 'Running report ...');
  const result = yield chronicle.run(body.report, body.parameters);
  log('info', { body }, 'Report ran.');
  response.writeHead(200, { 'Content-Type': mime.lookup('json') });
  response.end(JSON.stringify({ result }));
});

module.exports = run;
