'use strict';

var path = require('path');
var fs = require('fs');
var fsHelper = require('./helper/file');
var sass = require('node-sass');

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

  // set URI test
  if (config.dir && config.dir.lib)
    URI.lib = new RegExp('(' + config.dir.lib + '){1}', 'ig');
  if (config.dir && config.dir.component)
    URI.component = new RegExp('(' + config.dir.component + '){1}', 'ig');

  return function (pathname) {

    var extname = path.extname(pathname).toLocaleLowerCase();
    var filepath = '';

    if (extname === '.html') { // html
      // module page
      filepath = path.join(config.dir._module, pathname);

      if (fs.existsSync(filepath))
        return require('./renderer').renderHTML.call({
          base_dir: baseDir,
          user_option: config
        }, filepath);

      // tmpl page
      filepath = path.join(config.dir._common, pathname);
      if (fs.existsSync(filepath)) return filepath;
    }
    else if (extname === '.css') { // css
      var sassPath = fsHelper.getFilepath(pathname.replace(/\.css/ig, '.scss'), config);
      // is sass
      if (sassPath) {
        filepath = sassPath.replace(/\.scss/ig, '.css');
        var css_data = sass.renderSync({
          file: sassPath,
          outFile: filepath,
          sourceMap: true
        }, function (err, result) {
          console.log(err);
        });


        fs.writeFileSync(filepath, css_data.css, 'utf-8');
        fs.writeFileSync(filepath + '.map', css_data.map, 'utf-8');
      }
    }
    // else if (EXTNAME.js.test(extname)) {
    //   // js
    // }
    // else {
    // }

    filepath = fsHelper.getFilepath(pathname, config);
    return filepath;

    // module file
    // filepath = path.join(config.dir._module, pathname);
    // if (fs.existsSync(filepath)) return filepath;

    // // common file
    // filepath = path.join(config.dir._common, pathname);
    // if (fs.existsSync(filepath)) return filepath;

    // // lib
    // if (URI.lib.test(pathname)) {
    //   filepath = path.join(config.dir._lib, pathname.replace(URI.lib, ''));
    //   if (fs.existsSync(filepath)) return filepath;
    // }
    // // component
    // if (URI.component.test(pathname)) {
    //   filepath = path.join(config.dir._component, pathname.replace(URI.component, ''));
    //   if (fs.existsSync(filepath)) return filepath;
    // }

    // return false;
  }
};
