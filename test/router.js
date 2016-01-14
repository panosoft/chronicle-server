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
var router;
var server;

describe('Router', () => {
  describe('create', () => {
    it('exists', () => expect(Router).to.be.an('object')
      .and.to.have.all.keys('create')
    );
    it('create instance', () => {
      router = Router.create({}, routes);
      expect(router).to.be.an('object')
        .and.to.have.all.keys('route');
    });
  });
  describe('route', () => {
    before(() => {
      server = Server.create({ key, cert }, router.route);
      return server.listen(port);
    });
    after(() => server.close());
    it('exists', () =>
      expect(router.route).to.be.a('function')
    );
    it('ordinary handler function', co.wrap(function * () {
      const path = '/ordinary';
      const response = yield request('POST', `${host}${path}`);
      expect(response.statusCode).to.equal(200);
    }));
    it('yieldable handler function', co.wrap(function * () {
      const path = '/yieldable';
      const response = yield request('GET', `${host}${path}`);
      expect(response.statusCode).to.equal(200);
    }));
    it('handle unsupported methods', co.wrap(function * () {
      const path = '/ordinary';
      const response = yield request('GET', `${host}${path}`);
      expect(response.statusCode).to.equal(405);
      expect(response.headers).to.have.property('allow')
        .that.equals(R.join(',', R.keys(routes[path])));
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
    }));
    it('handle invalid pathnames', co.wrap(function * () {
      const path = '/invalid';
      const response = yield request('GET', `${host}${path}`);
      expect(response.statusCode).to.equal(404);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
    }));
    it('handle route error', co.wrap(function * () {
      const path = '/error';
      const response = yield request('POST', `${host}${path}`);
      expect(response.statusCode).to.equal(500);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
    }));
    it('handle route rejection', co.wrap(function * () {
      const path = '/rejection';
      const response = yield request('POST', `${host}${path}`);
      expect(response.statusCode).to.equal(500);
      expect(response.headers).to.have.property('content-type')
        .that.equals(mime.lookup('json'));
      expect(response.body).to.be.an('object')
        .and.to.have.all.keys('error')
        .and.to.have.property('error').that.is.a('string');
    }));
    // TODO test logging: use ringbuffer
  });
});
