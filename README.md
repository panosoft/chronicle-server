# Chronicle Server

> An HTTPS Chronicle report server.

[![npm version](https://img.shields.io/npm/v/@panosoft/chronicle-server.svg)](https://www.npmjs.com/package/@panosoft/chronicle-server)
[![Travis](https://img.shields.io/travis/panosoft/chronicle-server.svg)](https://travis-ci.org/panosoft/chronicle-server)

# Installation

```sh
npm install -g @panosoft/chronicle-server
```

# Usage

```sh
Usage: chronicle-server --key <path> --cert <path> [options]

An HTTPS Chronicle Server.

Options:

  -h, --help                    output usage information
  -V, --version                 output the version number
  -k, --key   <path>            Path to the private key of the server in PEM format.
  -c, --cert  <path>            Path to the certificate key of the server in PEM format.
  -p, --port  <port>            The port to accept connections on. Default: 8443.
  -i, --interface  <interface>  The interface to accept connections on. Default: 0.0.0.0.
```

# HTTPS API

## run

Run a report with a set of parameters.

### Request

- Pathname: `/`
- Method: `POST`
- Headers:
  - Content-Type: `'application/json'`
- Body:
  - `report` - _(Required)_ _{String}_ Url of the report bundle to run.
  - `parameters` - _{Object}_ An object of parameters to pass to report at runtime.

### Responses

__Success__

- Status Code: `200`
- Headers:
  - Request-Id: _{String}_ The unique request identifier.
  - Content-Type: `'application/json'`
- Body:
  - `result` - _{\*}_ The report output.

__Error__

- Status Code: `500`
- Headers:
  - Request-Id: _{String}_ The unique request identifier.
  - Content-Type: `'application/json'`
- Body:
  - `error` - _{String}_ The error message.
