'use strict';

exports.init     = require('./hangar/init');
exports.server   = require('./hangar/server');
exports.deploy   = require('./hangar/deploy');
exports.static   = function () {
  return false;
};
