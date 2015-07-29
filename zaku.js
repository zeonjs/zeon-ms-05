'use strict';

exports.init     = require('./hangar/init');
exports.server   = require('./hangar/server');
exports.renderer = require('./hangar/renderer');
exports.static   = function () {
  return false;
};
