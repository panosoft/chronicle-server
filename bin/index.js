#! /usr/bin/env node

const bunyan = require('bunyan');
const ChronicleServer = require('../lib');
const co = require('co');
const fs = require('fs');
const os = require('os');
const path = require('path');
const program = require('commander');
const R = require('ramda');
const readPkgUp = require('read-pkg-up');
const serialize = require('../lib/serialize');

var server;
const log = bunyan.createLogger({ name: 'chronicle-server' });
const shutdown = co.wrap(function * (code) {
  code = R.defaultTo(0, code);
  if (server) {
    log.info({ connections: yield server.connections() }, 'Stopping server ...');
    yield server.close();
    log.info({ connections: yield server.connections() }, 'Server stopped.');
  }
  process.exit(code);
});
process.on('uncaughtException', (error) => {
  log.fatal({ error: serialize(error) }, 'Uncaught Exception');
  shutdown(1);
});
process.on('unhandledRejection', (error) => {
  log.fatal({ error: serialize(error) }, 'Unhandled Rejection');
  shutdown(1);
});
process.on('SIGINT', () => {
  log.info('SIGINT received.');
  shutdown();
});
process.on('SIGTERM', () => {
  log.info('SIGTERM received.');
  shutdown();
});

co(function * () {
  try {
    const pkg = (yield readPkgUp()).pkg;
    program
      .version(pkg.version)
      .description(pkg.description)
      .usage('--key <path> --cert <path> [options]')
      .option('-k, --key   <path>', 'Path to the private key of the server in PEM format.')
      .option('-c, --cert  <path>', 'Path to the certificate key of the server in PEM format.')
      .option('-p, --port  <port>', 'The port to accept connections on. Default: 8443.')
      .option('-i, --interface  <interface>', 'The interface to accept connections on. Default: 0.0.0.0.')
      .parse(process.argv);
    log.info({
      arch: process.arch,
      platform:process.platform,
      release: os.release(),
      version: process.version,
      cwd: process.cwd(),
      argv: process.argv
    });
    log.info({ 'chronicle-server': pkg.version });
    log.info({ arguments: R.pick(['key', 'cert', 'port', 'interface'], program) });
    if (!program.key) throw new TypeError('--key must be specified');
    if (!program.cert) throw new TypeError('--cert must be specified');

    log.info('Reading key ...');
    const key = fs.readFileSync(path.resolve(program.key));
    log.info('Key read.');
    log.info('Reading cert ...');
    const cert = fs.readFileSync(path.resolve(program.cert));
    log.info('Cert read.');
    const port = program.port || 8443;
    const host = program.host;

    log.info('Creating server ...');
    server = ChronicleServer.create({ key, cert, log });
    log.info('Server created.');

    log.info('Starting server ...');
    yield server.listen(port, host);
    log.info(server.address(), 'Server started.');
}
  catch (error) { // REVIEW necessary? would be caught by unhandledRejection
    log.fatal(error);
    shutdown(1);
  }
});
