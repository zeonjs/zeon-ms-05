'use strict';

exports.init     = require('./hangar/init');
exports.server   = require('./hangar/server');
exports.static   = function () {
  return false;
};
