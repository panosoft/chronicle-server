const bunyan = require('bunyan');
const co = require('co');
const concat = require('concat-stream');
const cp = require('child_process');
const expect = require('chai').expect;
const fs = require('fs');
const https = require('https');
const mime = require('mime-types');
const parseJson = require('parse-json');
const path = require('path');
const R = require('ramda');
const url = require('url');

const ca = fs.readFileSync(path.resolve(__dirname, 'credentials/ca.crt'));
const key = `${__dirname}/credentials/server.key`;
const cert = `${__dirname}/credentials/server.crt`;
const bin = path.resolve(__dirname, '../bin/index.js');

const startServer = () => new Promise((resolve, reject) => {
  const split = R.compose(R.reject(R.isEmpty), R.split('\n'));
  const parseRecords = stdout => R.map(parseJson, split(stdout.toString('utf8')));
  const isInfo = R.compose(R.equals(bunyan.INFO), R.prop('level'));
  const isStarted = R.compose(R.equals(`Server started.`), R.prop('msg'));
  const server = cp.spawn(bin, ['--key', key, '--cert', cert]);
  server.stderr.pipe(concat(data => data ? reject(data.toString('utf8')) : null));
  server.stdout.once('data', function check (data) {
    var records;
    try { records = parseRecords(data); }
    catch (error) { return reject(error); }
    if (!R.all(isInfo, records)) { reject(records); }
    else if (R.any(isStarted, records)) { resolve(server); }
    else { server.stdout.once('data', check); }
  });
});
const parse = url.parse;
const request = co.wrap(function * (url, method, headers, data) {
  const response = yield new Promise((resolve, reject) => https
    .request(R.merge(parse(url), { ca, headers, method }), resolve)
    .on('error', reject)
    .end(data));
  const buffer = yield new Promise(resolve => response.pipe(concat(resolve)));
  if (buffer.length > 0) response.body = buffer;
  return response;
});

const expectError = (response, message) => {
  const body = JSON.parse(response.body.toString('utf8'));
  expect(response.statusCode).to.equal(500);
  expect(body).to.be.an('object')
    .and.to.have.property('error')
    .that.equals(message);
};

describe('routes', () => {
  describe('/', () => {
    var server;
    const port = 8443;
    const pathname = '/';
    const url = `https://localhost:${port}${pathname}`;
    const method = 'POST';
    const headers = { 'content-type': mime.lookup('json') };
    before(co.wrap(function * () {
      server = yield startServer();
    }));
    after(() => server.kill());
    it('reject request with invalid content-type header', co.wrap(function * () {
      const headers = { 'content-type': mime.lookup('txt') };
      const response = yield request(url, method, headers);
      expectError(response, 'Invalid request: header: request content-type must be application/json');
    }));
    it('reject request if body is not an object', co.wrap(function * () {
      const data = JSON.stringify(['test']);
      const response = yield request(url, method, headers, data);
      expectError(response, 'Invalid request: body: must be an object.');
    }));
    it('reject request without report field', co.wrap(function * () {
      const data = JSON.stringify({});
      const response = yield request(url, method, headers, data);
      expectError(response, 'Invalid request: body: report field must be defined.');
    }));
    it('reject request with invalid report field', co.wrap(function * () {
      const data = JSON.stringify({ report: {} });
      const response = yield request(url, method, headers, data);
      expectError(response, 'Invalid request: body: report field must be a string.');
    }));
    it('run report with parameters', co.wrap(function * () {
      const report = path.resolve(__dirname, 'report/index.js');
      const parameters = 'Test';
      const data = JSON.stringify({ report, parameters });
      const response = yield request(url, method, headers, data);
      expect(response.statusCode).to.equal(200);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.have.length.greaterThan(0);
      const body = JSON.parse(response.body.toString('utf8'));
      expect(body).to.be.an('object')
        .and.to.have.all.keys('result');
      expect(body.result).to.equal(parameters);
    }));
  });
});
