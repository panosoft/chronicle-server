const co = require('co');
const expect = require('chai').expect;
const HttpsServer = require('@panosoft/https-server');
const mime = require('mime-types');
const path = require('path');

const bin = path.resolve(__dirname, '../bin/index.js');
const startServer = HttpsServer.test.startServer;
const request = HttpsServer.test.request;

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
    const pathname = '/';
    const method = 'POST';
    const headers = { 'content-type': mime.lookup('json') };
    before(co.wrap(function * () {
      server = yield startServer(bin);
    }));
    after(() => server.kill());
    it('reject request with invalid content-type header', co.wrap(function * () {
      const headers = { 'content-type': mime.lookup('txt') };
      const response = yield request(pathname, method, headers);
      expectError(response, 'Invalid request: header: request content-type must be application/json');
    }));
    it('reject request if body is not an object', co.wrap(function * () {
      const data = JSON.stringify(['test']);
      const response = yield request(pathname, method, headers, data);
      expectError(response, 'Invalid request: body: must be an object.');
    }));
    it('reject request without report field', co.wrap(function * () {
      const data = JSON.stringify({});
      const response = yield request(pathname, method, headers, data);
      expectError(response, 'Invalid request: body: report field must be defined.');
    }));
    it('reject request with invalid report field', co.wrap(function * () {
      const data = JSON.stringify({ report: {} });
      const response = yield request(pathname, method, headers, data);
      expectError(response, 'Invalid request: body: report field must be a string.');
    }));
    it('run report with parameters', co.wrap(function * () {
      const report = path.resolve(__dirname, 'report/index.js');
      const parameters = 'Test';
      const data = JSON.stringify({ report, parameters });
      const response = yield request(pathname, method, headers, data);
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
