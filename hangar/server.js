'use strict';

var path = require('path');
var fs = require('fs');

// var config = {};
// var baseDir = '';

var EXTNAME = {
  html: /^\.(htm|html)$/ig,
  js: /^\.js$/ig,
  css: /^\.css$/ig
}
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
  config.dir._component= path.join(config.dir._root, config.dir.component);

  // set URI test
  if (config.dir && config.dir.lib)
    URI.lib = new RegExp('(' + config.dir.lib + '){1}', 'ig');
  if (config.dir && config.dir.component)
    URI.component = new RegExp('(' + config.dir.component + '){1}', 'ig');

  var commonPath = path.join(baseDir, config.dir.common);
  var modulePath = path.join(baseDir, config.dir.module);

  return function ( pathname ) {

    var extname = path.extname(pathname).toLocaleLowerCase();
    var filepath = '';

    if (extname === '.html') { // html
      // module page
      filepath = path.join(modulePath, pathname);

      if (fs.existsSync(filepath))
        return require('./renderer').renderHTML.call({
          base_dir: baseDir,
          user_option: config
        }, filepath);

      // tmpl page
      filepath = path.join(commonPath, pathname);
      if (fs.existsSync(filepath)) return filepath;
    }
    // else if (EXTNAME.js.test(extname)) {
    //   // js
    // }
    // else if (EXTNAME.css.test(extname)) {
    //   // css
    // }
    // else {
    // }

    // module file
    filepath = path.join(modulePath, pathname);
    if (fs.existsSync(filepath)) return filepath;

    // common file
    filepath = path.join(commonPath, pathname);
    if (fs.existsSync(filepath)) return filepath;

    // lib
    if (URI.lib.test(pathname)) {
      filepath = path.join(baseDir, config.dir.lib, pathname.replace(URI.lib, ''));
      if (fs.existsSync(filepath)) return filepath;
    }
    // component
    if (URI.component.test(pathname)) {
      filepath = path.join(baseDir, config.dir.component, pathname.replace(URI.component, ''));
      if (fs.existsSync(filepath)) return filepath;
    }

    return false;
  }
};
