'use strict';

var fs = require('fs');

// var sass = require('node-sass');
// var stylus = require('');
var less = require('less');

function anysc () {
}

// 同步解析
function sync (filepath, config) {
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
