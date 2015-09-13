'use strict';

var path = require('path');
var fs = require('fs');
var fsHelper = require('./helper/file');

var sass = (function () {
  try {
    return require('node-sass');
  } catch (ex) {
    console.log('there is no [node-sass] module in your computer, for deploy module.');
    return null;
  }
})()

// var config = {};
// var baseDir = '';

var URI = {
  lib: /(\/lib){1}/ig,
  component: /(\/component){1}/ig
}

// global exports
exports = module.exports = function (config) {
  var baseDir = this.base_dir || '';
  var config = config || {};
  config.dir._root = baseDir;
  config.dir._common = path.join(config.dir._root, config.dir.common);
  config.dir._module = path.join(config.dir._root, config.dir.module);
  config.dir._lib = path.join(config.dir._root, config.dir.lib);
  config.dir._component = path.join(config.dir._root, config.dir.component);
  config.dir._layout = path.join(config.dir._root, config.dir.layout);
  config.dir._dist = path.join(config.dir._root, config.dir.dist);

  require('./renderer/html').deploy(config);
};
