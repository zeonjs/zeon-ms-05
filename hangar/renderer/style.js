'use strict';

var fs = require('fs');
var path = require('path');
var fsHelper = require('../helper/file');

// var sass = require('node-sass');
var stylus = (function () {
  try {
    return require('stylus');
  } catch (ex) {
    return null;
  }
})();
var less = require('less');

function anysc (filepath, config, callback) {
}

// 同步解析
function sync (pathname, config) {
  var css_content = null;
  // less
  var less_path = fsHelper.getFilepath(pathname.replace(/\.css/ig, '.less'), config);
  if (less_path) {
    var file_content = fs.readFileSync(less_path, 'utf-8');
    var file_parse = path.parse(less_path);
    css_content = less.render(file_content, {
      paths: [file_parse.dir],
      sync: true
    });
    console.log(css_content);
  }

  return css_content;
}

function _sass () {
}

function _stylus () {
}

function _less (content, options, callback) {
  less.render(content, options);
}
_less.prototype.anysc = function () {};
_less.prototype.sync = function () {};

module.exports = exports = anysc;
exports.sync = sync;
exports.sass = _sass;
exports.stylus = _stylus;
exports.less = _less;
