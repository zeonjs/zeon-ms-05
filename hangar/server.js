'use strict';

var path = require('path');

var config = {};
var baseDir = '';

exports = module.exports = function (config) {
  baseDir = this.base_dir;
  config = config;

  return function (pathname) {
  }
};
