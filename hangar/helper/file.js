'use strict';

var path = require('path');
var fs = require('fs');

// 文件类型
var filetype = {
  'module': 1,
  'common': 2,
  'component': 3,
  'lib': 4
};

// 是否是module
var isModule = function (pathname, config) {
  return is(pathname, config, filetype.module, config.dir.module, config.dir._module);
};
// 是否是Common
var isCommon= function (pathname, config) {
  return is(pathname, config, filetype.common, config.dir.common, config.dir._common);
};
// 是否是Common
var isComponent= function (pathname, config) {
  return is(pathname, config, filetype.component, config.dir.component, config.dir._component);
};
// 是否是Common
var isLib= function (pathname, config) {
  return is(pathname, config, filetype.lib, config.dir.lib, config.dir._lib);
};

// 判断文件类型
function is (pathname, config, type, rel, abs) {
  var filepath = pathname;

  if (filepath.indexOf(rel) >= 0) {
    filepath = path.join(config.dir._root, filepath);
  } else {
    filepath = path.join(abs, filepath);
  }

  if (fs.existsSync(filepath)) {
    return {
      type: type,
      filepath: filepath
    };
  } else {
    return null;
  }
};

// 获取绝对路径
var getFilepath = function (pathname, config) {
  var path;
  path = isModule(pathname, config);
  if (path) return path.filepath;

  path = isCommon(pathname, config);
  if (path) return path.filepath;

  path = isComponent(pathname, config);
  if (path) return path.filepath;

  path = isLib(pathname, config);
  if (path) return path.filepath;
}

exports.type = filetype;
exports.isModule = isModule;
exports.isCommon = isCommon;
exports.isComponent = isComponent;
exports.isLib = isLib;
exports.getFilepath = getFilepath;
