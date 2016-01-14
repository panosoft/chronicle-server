const ChronicleServer = require('../lib');
const co = require('co');
const concat = require('concat-stream');
const expect = require('chai').expect;
const fs = require('fs');
const https = require('https');
const mime = require('mime-types');
const path = require('path');
const R = require('ramda');
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

describe('chronicle-server', () => {
  const config = { key, cert };
  const port = 8443;
  const server = ChronicleServer.create(config);
  const url = 'https://localhost:8443/';
  before(() => server.listen(port));
  after(() => server.close());
  describe('route: /', () => {
    it('reject request if content-type not json', co.wrap(function * () {
      const headers = { 'content-type': mime.lookup('txt') };
      const response = yield post(url, headers);
      expect(response.statusCode).to.equal(415);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
    }));
    it('reject request if body is not an object', co.wrap(function * () {
      const headers = { 'content-type': mime.lookup('json') };
      const data = JSON.stringify(['test']);
      const response = yield post(url, headers, data);
      expect(response.statusCode).to.equal(400);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
    }));
    it('reject request if body report field is not defined', co.wrap(function * () {
      const headers = { 'content-type': mime.lookup('json') };
      const data = JSON.stringify({});
      const response = yield post(url, headers, data);
      expect(response.statusCode).to.equal(400);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
    }));
    it('reject request if body report field is not a string', co.wrap(function * () {
      const headers = { 'content-type': mime.lookup('json') };
      const data = JSON.stringify({ report: {} });
      const response = yield post(url, headers, data);
      expect(response.statusCode).to.equal(400);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
    }));
    it('accept valid request and return output', co.wrap(function * () {
      const headers = { 'content-type': mime.lookup('json') };
      const report = path.resolve(__dirname, 'report/index.js');
      const parameters = 'Test';
      const data = JSON.stringify({ report, parameters });
      const response = yield post(url, headers, data);
      expect(response.statusCode).to.equal(200);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('result')
        .and.to.have.property('result').that.equals(parameters);
    }));
  });
});
