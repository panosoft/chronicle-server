const bunyan = require('bunyan');
const HttpsServer = require('@panosoft/https-server');
const co = require('co');
const concat = require('concat-stream');
const expect = require('chai').expect;
const fs = require('fs');
const https = require('https');
const mime = require('mime-types');
const path = require('path');
const R = require('ramda');
const routes = require('../lib/routes');
const url = require('url');

const ca = fs.readFileSync(path.resolve(__dirname, 'credentials/rootCA.pem'));
const key = fs.readFileSync(path.resolve(__dirname, 'credentials/privateKey.pem'));
const cert = fs.readFileSync(path.resolve(__dirname, 'credentials/certificate.pem'));
const parse = url.parse;
const post = co.wrap(function * (url, headers, data) {
  const response = yield new Promise((resolve, reject) => https
    .request(R.merge(parse(url), { ca, headers, method: 'POST' }), resolve)
    .on('error', reject)
    .end(data));
  const buffer = yield new Promise(resolve => response.pipe(concat(resolve)));
  if (buffer.length > 0) response.body = JSON.parse(buffer.toString('utf8'));
  return response;
});

const expectBody = (body) => {
  expect(body).to.be.an('object')
    .and.to.contain.key('report');
};
const expectError = (error, message) => {
  expect(error).to.be.an('object')
    .and.to.have.all.keys('message', 'stack');
  if (message) expect(error.message).to.match(message);
};
const expectRequest = (request) => {
  expect(request).to.be.an('object')
    .and.to.have.all.keys('id', 'method', 'url', 'httpVersion', 'headers', 'connection');
  expect(request.headers).to.be.an('object');
  expect(request.connection).to.be.an('object')
    .and.to.have.all.keys('remoteAddress', 'remoteFamily', 'remotePort');
};
const expectErrorRecord = (record, msg, errorMessage) => {
  expect(record).to.be.an('object')
    .and.to.contain.keys('msg', 'request', 'error');
  if (msg) expect(record.msg).to.match(msg);
  expectRequest(record.request);
  expectError(record.error, errorMessage);
};
const expectRunningRecord = (record) => {
  expect(record).to.be.an('object')
    .and.to.contain.keys('msg', 'request', 'body');
  expect(record.msg).to.match(/Running report .../);
  expectRequest(record.request);
  expectBody(record.body);
};
const expectRanRecord = (record) => {
  expect(record).to.be.an('object')
    .and.to.contain.keys('msg', 'request', 'body');
  expect(record.msg).to.match(/Report ran./);
  expectRequest(record.request);
  expectBody(record.body);
};

describe('routes', () => {
  describe('/', () => {
    var buffer;
    var server;
    const port = 8443;
    const pathname = '/';
    const url = `https://localhost:${port}${pathname}`;
    beforeEach(() => {
      buffer = new bunyan.RingBuffer();
      const logger = bunyan.createLogger({
        name: 'test',
        streams: [{type: 'raw', stream: buffer}]
      });
      const options = { key, cert, logger };
      server = HttpsServer.create(options, routes);
      return server.listen(port);
    });
    afterEach(() => server.close());
    it('reject request if content-type not json', co.wrap(function * () {
      const headers = { 'content-type': mime.lookup('txt') };
      const response = yield post(url, headers);
      // response
      expect(response.statusCode).to.equal(500);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
      // logs
      expect(buffer.records).to.have.length(3);
      expectErrorRecord(buffer.records[1], /Internal server error./, /request content-type must be/);
    }));
    it('reject request if body is not an object', co.wrap(function * () {
      const headers = { 'content-type': mime.lookup('json') };
      const data = JSON.stringify(['test']);
      const response = yield post(url, headers, data);
      // response
      expect(response.statusCode).to.equal(500);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
      // logs
      expect(buffer.records).to.have.length(3);
      expectErrorRecord(buffer.records[1], /Internal server error./, /body must be an object./);
    }));
    it('reject request if body report field is not defined', co.wrap(function * () {
      const headers = { 'content-type': mime.lookup('json') };
      const data = JSON.stringify({});
      const response = yield post(url, headers, data);
      // response
      expect(response.statusCode).to.equal(500);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
      // logs
      expect(buffer.records).to.have.length(3);
      expectErrorRecord(buffer.records[1], /Internal server error./, /report field must be defined./);
    }));
    it('reject request if body report field is not a string', co.wrap(function * () {
      const headers = { 'content-type': mime.lookup('json') };
      const data = JSON.stringify({ report: {} });
      const response = yield post(url, headers, data);
      // response
      expect(response.statusCode).to.equal(500);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
      // logs
      expect(buffer.records).to.have.length(3);
      expectErrorRecord(buffer.records[1], /Internal server error./, /report field must be a string./);
    }));
    it('accept valid request and return output', co.wrap(function * () {
      const headers = { 'content-type': mime.lookup('json') };
      const report = path.resolve(__dirname, 'report/index.js');
      const parameters = 'Test';
      const data = JSON.stringify({ report, parameters });
      const response = yield post(url, headers, data);
      // response
      expect(response.statusCode).to.equal(200);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('result');
      expect(response.body.result).to.equal(parameters);
      // logs
      expect(buffer.records).to.have.length(4);
      expectRunningRecord(buffer.records[1]);
      expectRanRecord(buffer.records[2]);
    }));
  });
});
