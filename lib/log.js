const R = require('ramda');

const Log = R.curry(function (logger, level) {
  if (logger) logger[level].apply(logger, Array.from(arguments).slice(2));
});

module.exports = Log;
