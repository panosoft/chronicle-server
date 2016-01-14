const R = require('ramda');

const logger = R.curry(function (log, level) {
  if (log) log[level].apply(log, Array.from(arguments).slice(2));
});

module.exports = logger;
