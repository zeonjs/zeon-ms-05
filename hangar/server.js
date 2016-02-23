'use strict';

var path = require('path');
var fs = require('fs');
var i18n = require('./i18n');
var fsHelper = require('./helper/file');

var sass = (function () {
  try {
    return require('node-sass');
  } catch (ex) {
    console.log('there is no [node-sass] module in your computer, for server module.');
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
  config.dir._lang = path.join(config.dir._root, config.dir.lang);

  // set URI test
  if (config.dir && config.dir.lib)
    URI.lib = new RegExp('(' + config.dir.lib + '){1}', 'ig');
  if (config.dir && config.dir.component)
    URI.component = new RegExp('(' + config.dir.component + '){1}', 'ig');

  return function (pathname) {

    var extname = path.extname(pathname).toLocaleLowerCase();
    var filepath = '';
    var opt = {
      base_dir: baseDir,
      user_option: config
    };

    // html
    if (extname === '.html') {

      // module page
      filepath = path.join(config.dir._module, pathname);
      if (fs.existsSync(filepath)) {
        var content = require('./renderer/html').call(opt, filepath);
        return i18n.call(opt, content);
      }

      // tmpl page
      filepath = path.join(config.dir._common, pathname);
      if (fs.existsSync(filepath)) {
        return i18n.read.call(opt, filepath);
      }

      // other page
      filepath = path.join(config.dir._root, pathname);
      if (fs.existsSync(filepath)) {
        return i18n.read.call(opt, filepath);
      }

    }
    // js
    else if (extname === '.js') {
      filepath = fsHelper.getFilepath(pathname, config);
      if (filepath.indexOf('\\lib\\') == -1 && fs.existsSync(filepath)) {
        return i18n.read.call(opt, filepath);
      }
    }
    // css
    else if (extname === '.css') {
      /*var css_content = require('./renderer/style').sync(pathname, config);
      if (css_content) {
        return css_content;
      }*/
      var sassPath = fsHelper.getFilepath(pathname.replace(/\.css/ig, '.scss'), config);
      // is sass
      if (sassPath && sass) {
        // filepath = sassPath.replace(/\.scss/ig, '.css');
        var sass_data = fs.readFileSync(sassPath, 'utf-8');
        var css_data = sass.renderSync({
          // outFile: filepath,
          // sourceMap: true,
          file: sassPath
          // data: sass_data,
          // outputStyle: 'compressed',
          // includePaths: path.parse(sassPath).dir
        }, function (err, result) {
          console.log(err);
        });


        // fs.writeFileSync(filepath, css_data.css, 'utf-8');
        // fs.writeFileSync(filepath + '.map', css_data.map, 'utf-8');
        var css_content = css_data.css.toString('utf-8');
        return css_content;
      }
    }
    else {
    }

    filepath = fsHelper.getFilepath(pathname, config);
    return filepath;
  }
};
