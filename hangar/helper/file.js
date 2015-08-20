'use strict';

var path = require('path');
var fs = require('fs');

// 文件类型
var filetype = {
  module: 'module',
  common: 'common',
  component: 'component',
  lib: 'lib'
};

// 是否是module
var isModule = function (pathname, config, from) {
  return is(pathname, config, from, filetype.module, config.dir.module, config.dir._module);
};
// 是否是Common
var isCommon= function (pathname, config, from) {
  return is(pathname, config, from, filetype.common, config.dir.common, config.dir._common);
};
// 是否是Common
var isComponent= function (pathname, config, from) {
  return is(pathname, config, from, filetype.component, config.dir.component, config.dir._component);
};
// 是否是Common
var isLib= function (pathname, config, from) {
  return is(pathname, config, from, filetype.lib, config.dir.lib, config.dir._lib);
};

// 判断文件类型
function is (pathname, config, from, type, rel, abs) {
  var filepath = pathname;

  if (from) {
    filepath = path.join(from, pathname);
  }

  if (filepath.indexOf(abs) == 0) {
  } else {
    filepath = filepath.replace(/^(\.?\.\/)+/ig, '/');

    if (filepath.indexOf(rel) >= 0) {
      filepath = path.join(config.dir._root, filepath);
    } else {
      filepath = path.join(abs, filepath);
    }
  }

  if (fs.existsSync(filepath)) {
    var sitepath = '';
    if (type == filetype.module || type == filetype.common) {
      sitepath = filepath.replace(config.dir['_' + type], '').replace(/\\/ig, '');
    } else {
      sitepath = filepath.replace(config.dir[type], '').replace(/\\/ig, '');
    }
    var data = {
      type: type,
      filepath: filepath,
      sitepath: sitepath
    };
    return data;
  } else {
    return null;
  }
};

var getFileObject = function (pathname, config, from) {
  var path;
  path = isModule(pathname, config, from);
  if (path) return path;

  path = isCommon(pathname, config, from);
  if (path) return path;

  path = isComponent(pathname, config, from);
  if (path) return path;

  path = isLib(pathname, config, from);
  if (path) return path;

  return null;
}

// 获取绝对路径
var getFilepath = function (pathname, config, from) {
  var file_object = getFileObject(pathname, config, from);
  return file_object ? file_object.filepath : null;
}

// 获取绝对路径
var getSitepath = function (pathname, config, from) {
  var file_object = getFileObject(pathname, config, from);
  return file_object ? file_object.sitepath : null;
}

exports.type = filetype;
exports.isModule = isModule;
exports.isCommon = isCommon;
exports.isComponent = isComponent;
exports.isLib = isLib;
exports.getFilepath = getFilepath;
exports.getSitepath = getSitepath;
