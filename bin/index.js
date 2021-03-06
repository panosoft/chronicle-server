#! /usr/bin/env node

const path = require('path');
const HttpsServer = require('@panosoft/https-server');
const routes = require('../lib/routes');

const packageFilename = path.resolve(__dirname, '../package.json');
HttpsServer.cli(packageFilename, routes);
