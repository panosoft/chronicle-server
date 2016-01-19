const bunyan = require('bunyan');
const co = require('co');
const concat = require('concat-stream');
const expect = require('chai').expect;
const fs = require('fs');
const https = require('https');
const mime = require('mime-types');
const path = require('path');
const R = require('ramda');
const Router = require('../lib/router');
const Server = require('../lib/server');
const url = require('url');

const port = 8443;
const host = `https://localhost:${port}`;
const ca = fs.readFileSync(path.resolve(__dirname, 'credentials/rootCA.pem'));
const key = fs.readFileSync(path.resolve(__dirname, 'credentials/privateKey.pem'));
const cert = fs.readFileSync(path.resolve(__dirname, 'credentials/certificate.pem'));
const parse = url.parse;
const request = co.wrap(function * (method, url, data) {
  const response = yield new Promise((resolve, reject) =>
    https.request(R.merge(parse(url), { ca, method }), resolve)
      .on('error', reject)
      .end(data));
  const buffer = yield new Promise(resolve => response.pipe(concat(resolve)));
  if (buffer.length > 0) response.body = JSON.parse(buffer.toString('utf8'));
  return response;
});

const ordinary = (request, response) => {
  response.writeHead(200);
  response.end();
};
const yieldable = (request, response) =>
  new Promise(resolve => setTimeout(() => {
    response.writeHead(200);
    response.end();
    resolve();
  }, 1));
const error = () => { throw new Error('Internal error'); };
const rejection = () => Promise.reject(new Error('Rejected promise'));
const routes = {
  '/ordinary': { POST: ordinary, DELETE: ordinary },
  '/yieldable': { GET: yieldable },
  '/error': { POST: error },
  '/rejection': { POST: rejection }
};

const expectError = (error) => {
  expect(error).to.be.an('object')
    .and.to.have.all.keys('message', 'stack');
};
const expectRequest = (request) => {
  expect(request).to.be.an('object')
    .and.to.have.all.keys('id', 'method', 'url', 'httpVersion', 'headers', 'connection');
  expect(request.headers).to.be.an('object');
  expect(request.connection).to.be.an('object')
    .and.to.have.all.keys('remoteAddress', 'remoteFamily', 'remotePort');
};
const expectResponse = (response) => {
  expect(response).to.be.an('object')
    .and.to.have.all.keys('statusMessage', 'statusCode', 'headers');
  expect(response.headers).to.be.an('object');
};
const expectErrorRecord = (record, msg) => {
  expect(record).to.be.an('object')
    .and.to.contain.keys('request', 'error');
  if (msg) expect(record.msg).to.match(msg);
  expectRequest(record.request);
  expectError(record.error);
};
const expectRequestRecord = (record) => {
  expect(record).to.be.an('object')
    .and.to.contain.keys('msg', 'request');
  expect(record.msg).to.match(/Request received./);
  expectRequest(record.request);
};
const expectResponseRecord = (record) => {
  expect(record).to.be.an('object')
    .and.to.contain.keys('msg', 'request', 'response');
  expect(record.msg).to.match(/Response sent./);
  expectRequest(record.request);
  expectResponse(record.response);
};

describe('Router', () => {
  describe('create', () => {
    it('exists', () => expect(Router).to.be.an('object')
      .and.to.have.all.keys('create')
    );
    it('create instance', () => {
      var router = Router.create({}, routes);
      expect(router).to.be.an('object')
        .and.to.have.all.keys('route');
    });
  });
  describe('route', () => {
    var buffer;
    var router;
    var server;
    beforeEach(() => {
      buffer = new bunyan.RingBuffer();
      const logger = bunyan.createLogger({
        name: 'test',
        streams: [{type: 'raw', stream: buffer}]
      });
      router = Router.create({ logger }, routes);
      server = Server.create({ key, cert }, router.route);
      return server.listen(port);
    });
    afterEach(() => server.close());
    it('exists', () =>
      expect(router.route).to.be.a('function')
    );
    it('handle invalid pathnames', co.wrap(function * () {
      const path = '/invalid';
      const response = yield request('GET', `${host}${path}`);
      // response
      expect(response.statusCode).to.equal(404);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
      // logs
      expect(buffer.records).to.have.length(3);
      expectRequestRecord(buffer.records[0]);
      expectErrorRecord(buffer.records[1], /Not found./);
      expectResponseRecord(buffer.records[2]);
    }));
    it('handle unsupported methods', co.wrap(function * () {
      const path = '/ordinary';
      const response = yield request('GET', `${host}${path}`);
      // response
      expect(response.statusCode).to.equal(405);
      expect(response.headers).to.have.property('allow')
        .that.equals(R.join(',', R.keys(routes[path])));
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
      // logs
      expect(buffer.records).to.have.length(3);
      expectRequestRecord(buffer.records[0]);
      expectErrorRecord(buffer.records[1], /Method not allowed./);
      expectResponseRecord(buffer.records[2]);
    }));
    it('accept ordinary handler function', co.wrap(function * () {
      const path = '/ordinary';
      const response = yield request('POST', `${host}${path}`);
      // response
      expect(response.statusCode).to.equal(200);
      // logs
      expect(buffer.records).to.have.length(2);
      expectRequestRecord(buffer.records[0]);
      expectResponseRecord(buffer.records[1]);
    }));
    it('handle ordinary handler function error', co.wrap(function * () {
      const path = '/error';
      const response = yield request('POST', `${host}${path}`);
      // response
      expect(response.statusCode).to.equal(500);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
      // logs
      expect(buffer.records).to.have.length(3);
      expectRequestRecord(buffer.records[0]);
      expectErrorRecord(buffer.records[1], /Internal server error./);
      expectResponseRecord(buffer.records[2]);
    }));
    it('accept yieldable handler function', co.wrap(function * () {
      const path = '/yieldable';
      const response = yield request('GET', `${host}${path}`);
      // response
      expect(response.statusCode).to.equal(200);
      // logs
      expect(buffer.records).to.have.length(2);
      expectRequestRecord(buffer.records[0]);
      expectResponseRecord(buffer.records[1]);
    }));
    it('handle yieldable handler function rejection', co.wrap(function * () {
      const path = '/rejection';
      const response = yield request('POST', `${host}${path}`);
      // response
      expect(response.statusCode).to.equal(500);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
      // logs
      expect(buffer.records).to.have.length(3);
      expectRequestRecord(buffer.records[0]);
      expectErrorRecord(buffer.records[1], /Internal server error./);
      expectResponseRecord(buffer.records[2]);
    }));
  });
});
