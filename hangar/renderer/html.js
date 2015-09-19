'use strict';

var _        = require('lodash');
var util     = require('util');
var path     = require('path');
var fs       = require('fs');
var fsEx     = require('fs-extra');
var walk     = require('walk');
var crypto   = require('crypto');
var swig     = require('swig');
var glob     = require('glob');
var chalk    = require('chalk');
var fm       = require('zeon-front-matter');
var fsHelper = require('../helper/file');

swig.setDefaults({ varControls: ['{$', '$}'] });

var reg = {
  // section
  section: /(<!--\[section (\S+?)\]\[\/section\]-->)|(<!--\[section (\S+?)\]-->[\s\S]*?<!--\[\/section\]-->)/ig,
  // include
  include: /(<!--\[include (\S+?)\]\[\/include\]-->)|(<!--\[include (\S+?)\]-->[\s\S]*?<!--\[\/include\]-->)/ig,
  // html body
  body: /<body[^>]*?>([\s\S]*)<\/body>/ig,
  // 匹配link:css标签以及style标签
  css: /(?:[^>\n\r]*)(<link\s*.*href=["'].*\.s?css["'?].*\/?>|<style[^>]*>(?:[\S\s]*?)<\/style>)[\n\r]*/ig,
  // 匹配css文件路径
  cssPath: /href=(?:"|')?([^"' >]+)(?:"|')?/i,
  // 匹配css文件
  cssFile: /(?:[^"' >\/]+)\.s?css(?=["'?])/i,
  // 匹配script标签
  js: /(?:[^>\n\r]*)(<script[^>]*>(?:[\s\S]*?)<\/script\s*>)[\n\r]*/ig,
  // 匹配js文件路径
  jsPath: /^(?:[^>\n\r]*)<script[^>]+src=(?:"|')\s*(\S+)\s*(?:"|')/i,
  // 匹配js文件名
  jsFile: /(?:[^"' >\/]+)\.js(?=["'?])/i,
  // img
  img: /<img\s*.*src=["'].*\.(jpg|png|gif|bmp|jpeg|ico)["'?].*\/?>/ig,
  imgPath: /src=(?:"|')?([^"' >]+)(?:"|')?/i
}

var res_file_pattern = 'jpg,png,gif,bmp,jpeg,ico,eot,svg,ttf,woff,woff2';

/**
 * 渲染页面
 * @param  {string} filepath 页面路径
 * @return {string}          页面内容
 */
var renderHTML = function (filepath) {
  var baseDir = this.base_dir || '';
  var config = this.user_option || {};

  var d = getPageData(filepath, config);

  return getPageContent(d, config);
};
module.exports = exports = renderHTML;


//==============================================================================================

function getPageContent (data, config) {
  if (!data.layout) return data._content;

  var path_parse = path.parse(data.path);

  var temp = '';

  // css
  temp += '{% block style %}\n';
  var css_data = unionDataId(data.layout.css, data.css);
  css_data = removeDataId(css_data, data.layout.css);
  for (var i = 0, l = css_data.length; i < l; i++) {
    temp += css_data[i].content;
  }
  temp += '{% endblock %}\n';

  // js
  temp += '{% block script %}\n';
  var js_data = unionDataId(data.layout.js, data.js);
  js_data = removeDataId(js_data, data.layout.js);
  for (var i = 0, l = js_data.length; i < l; i++) {
    temp += js_data[i].content;
  }
  temp += '{% endblock %}\n';

  // content
  temp += '{% block content %}\n';
  temp += data.content;
  temp += '{% endblock %}\n';

  // swig render
  var layout_code = path.join(config.dir._root, encodeURIComponent(data.layout.id));
  temp = '{% extends "' + layout_code + '" %}\n' + temp;

  var template = {};
  template[layout_code] = data.layout.template;
  swig.invalidateCache();
  swig.setDefaults({ loader: swig.loaders.memory(template) });

  var page_relative_path = path.relative(path_parse.dir, config.dir._module);
  page_relative_path == '' ? page_relative_path = '.' : null;
  page_relative_path = page_relative_path.replace(/\\/ig, '/');

  var content = swig.render(temp, {
    locals: {
      _root: page_relative_path
    },
    filename: path.join(config.dir._root, encodeURIComponent(data.path))
  });

  return content;
}

//==============================================================================================

function getLayoutData (absolute_path, config) {
  var data = {
    id: absolute_path,
    path: absolute_path,
    template: '',
    js: [],
    css: [],
    content: '',
    _content: ''
  };

  var path_parse = path.parse(absolute_path);

  // read file content
  var temp = data.template = data._content = fs.readFileSync(absolute_path, 'utf8');


  // 替换section节点为swig block
  data.template = data.template.replace(reg.section, function () {
    var type = arguments[2] || arguments[4];
    return '{% block ' + type + ' %}{% endblock %}'
  });

  // img
  data.template = data.template.replace(reg.img, function () {
    var relative_path = arguments[0].match(reg.imgPath)[1];
    var absolute_path = fsHelper.getFilepath(relative_path, config, config.dir._layout);
    var path_with_root = setUrlRootParam(absolute_path, config);
    return arguments[0].replace(relative_path, path_with_root);
  });

  // css
  data.template = data.template.replace(reg.css, function () {
    var css_data = getStyleData(arguments[1], config, path_parse.dir);
    if (css_data) {
      data.css.push(css_data);
    }
    return css_data.content;
  });

  // js
  data.template = data.template.replace(reg.js, function () {
    var js_data = getScriptData(arguments[1], config, path_parse.dir);
    if (js_data) {
      data.js.push(js_data);
    }
    return js_data.content;
  });

  // body
  data.content = getBodyData(temp);

  return data;
}

function getPartialData (absolute_path, config) {
  var data = {
    id: absolute_path,
    path: absolute_path,
    js: [],
    css: [],
    content: '',
    _content: ''
  };

  var path_parse = path.parse(absolute_path);

  // read file content
  var temp = data._content = fs.readFileSync(absolute_path, 'utf8');

  // css
  temp = temp.replace(reg.css, function () {
    var css_data = getStyleData(arguments[1], config, path_parse.dir);
    if (css_data) {
      data.css.push(css_data);
    }
    return '';
  });

  // js
  temp = temp.replace(reg.js, function () {
    var js_data = getScriptData(arguments[1], config, path_parse.dir);
    if (js_data) {
      data.js.push(js_data);
    }
    return '';
  });

  // partial
  temp = temp.replace(reg.include, function () {
    var relative_path = arguments[2] ;
    var absolute_path = path.join(path_parse.dir, relative_path);
    var partial_data = getPartialData(absolute_path, config);

    // data.js = data.js.concat(partial_data.js);
    // data.css = data.css.concat(partial_data.css);

    data.js = unionDataId(data.js, partial_data.js);
    data.css = unionDataId(data.css, partial_data.css);

    return partial_data.content;
  });

  // body
  data.content = getBodyData(temp);

  return data;
}

function getPageData (absolute_path, config) {
  var data = {
    id: absolute_path,
    path: absolute_path,
    layout: null,
    js: [],
    css: [],
    content: '',
    _content: ''
  };

  var path_parse = path.parse(absolute_path);

  // read file content
  var file_content = fs.readFileSync(absolute_path, 'utf8');

  // layout
  var page_data = fm.parse(file_content);
  var temp = data._content = page_data._content;

  // layout
  var layout = false;
  if (page_data.hasOwnProperty('layout')) {
    layout = page_data.layout;
  } else if (config && config.layout && config.layout.default) {
    layout = config.layout.default;
  }

  // has layout
  var layout_path = path.join(config.dir._layout, layout + '.html');

  if (fs.existsSync(layout_path)) {
    if (config._deploy && config._deploy.layout && config._deploy.layout[layout_path]) {
      data.layout = config._deploy.layout[layout_path];
    } else {
      data.layout = getLayoutData(layout_path, config);
    }
  } else {
    data.layout = false;
  }

  // css
  temp = temp.replace(reg.css, function () {
    var css_data = getStyleData(arguments[1], config, path_parse.dir);
    if (css_data) {
      data.css.push(css_data);
    }
    return '';
  });

  // js
  temp = temp.replace(reg.js, function () {
    var js_data = getScriptData(arguments[1], config, path_parse.dir);
    if (js_data) {
      data.js.push(js_data);
    }
    return '';
  });

  // partial
  temp = temp.replace(reg.include, function () {
    var relative_path = arguments[2] ;
    var absolute_path = path.join(path_parse.dir, relative_path);
    var partial_data = getPartialData(absolute_path, config);

    // data.js = data.js.concat(partial_data.js);
    // data.css = data.css.concat(partial_data.css);

    data.js = unionDataId(data.js, partial_data.js);
    data.css = unionDataId(data.css, partial_data.css);

    return partial_data.content;
  });

  // body
  data.content = getBodyData(temp);

  return data;
}

//==============================================================================================

function getStyleData (content, config, page_path) {
  var data = {
    id: '',
    path: '',
    content: '',
    is_external: true
  };

  if (reg.cssPath.test(content)) {
    data.is_external = true;

    var relative_path = content.match(reg.cssPath)[1];
    var absolute_path = data.path = path.join(page_path, relative_path);

    data.id = getHash(absolute_path);
    // data.content = content.replace(relative_path, setUrlRootParam(absolute_path, config));

    var uri = '';
    if (config._deploy && config._deploy.style && config._deploy.style[absolute_path]) {
      uri = '{$_root$}' + config._deploy.style[absolute_path].uri;
    } else {
      uri = setUrlRootParam(absolute_path, config);
    }
    data.content = '<link rel="stylesheet" href="' + uri + '">';

  } else {
    data.is_external = false;

    data.id = getHash(content);
    data.content = content;
  }

  return data;
}
function getScriptData (content, config, page_path) {
  var data = {
    id: '',
    path: '',
    content: '',
    is_external: true
  };

  if (reg.jsPath.test(content)) {
    data.is_external = true;

    var relative_path = content.match(reg.jsPath)[1];
    var absolute_path = '';

    if (relative_path.indexOf('http') == 0) {
      absolute_path = relative_path;
      data.content = content;
    } else {
    var uri = '';
      absolute_path = data.path = path.join(page_path, relative_path);
      if (config._deploy && config._deploy.script && config._deploy.script[absolute_path]) {
        uri = '{$_root$}' + config._deploy.script[absolute_path].uri;
      } else {
        uri = setUrlRootParam(absolute_path, config);
      }
      // data.content = content.replace(relative_path, setUrlRootParam(absolute_path, config));
      data.content = '<script src="' + uri + '"></script>';
    }
    data.id = getHash(absolute_path);

  } else {
    data.is_external = false;

    data.id = getHash(content);
    data.content = content;
  }

  return data;
}
function getBodyData (content) {
  var body = content.match(reg.body);
  var body_content = body ? body[0] : content;
  body_content = body_content.replace(/^<body>/ig, '').replace(/<\/body>$/ig, '');
  return body_content;
}

//==============================================================================================

// 添加root参数
function setUrlRootParam (target_path, config) {
  var file_uri = target_path;
  if (typeof target_path != 'string') return target_path;
  // 是否在common中
  if (target_path.indexOf(config.dir._common) === 0) {
    file_uri = target_path.replace(config.dir._common, '').replace(/\\/ig, '/');
  }
  else if (target_path.indexOf(config.dir._module) === 0) {
    file_uri = target_path.replace(config.dir._module, '').replace(/\\/ig, '/');
  }
  else if (target_path.indexOf(config.dir._component) === 0) {
    file_uri = '/component' + target_path.replace(config.dir._component, '').replace(/\\/ig, '/');
  }
  else if (target_path.indexOf(config.dir._lib) === 0) {
    file_uri = '/lib' + target_path.replace(config.dir._lib, '').replace(/\\/ig, '/');
  }
  else {
    return target_path;
  }
  return '{$_root$}' + file_uri;
}

// 过滤重复的id对象
function unionDataId () {
  var new_data = [];
  if (arguments.length == 0) {
    return [];
  }
  else if (arguments.length == 1) {
    return arguments[0];
  }
  else {
    var temp1 = arguments[0].concat();
    var temp2 = arguments[1].concat();
    var temp = [];
    var ids = [];

    for (var i = 0, l1 = temp1.length; i < l1; i++) {
      ids.push(temp1[i].id);
    }

    for (var j = 0, l2 = temp2.length; j < l2; j++) {
      if (_.indexOf(ids, temp2[j].id) == -1) {
        temp.push(temp2[j]);
        ids.push(temp2[j].id);
      }
    }

    new_data = temp1.concat(temp);

    var eventData = Array.prototype.slice.call(arguments, 2);
    eventData.unshift(new_data);

    new_data = unionDataId.apply(unionDataId, eventData);
  }
  return new_data;
}

function removeDataId (target, from) {
  var temp1 = from.concat();
  var temp2 = target.concat();
  var temp = [];
  var ids = [];

  for (var i = 0, l1 = temp1.length; i < l1; i++) {
    ids.push(temp1[i].id);
  }

  for (var j = 0, l2 = temp2.length; j < l2; j++) {
    if (_.indexOf(ids, temp2[j].id) == -1) {
      temp.push(temp2[j]);
      ids.push(temp2[j].id);
    }
  }
  return temp;
}

// 获取内容MD5
function getHash (data) {
  var md5sum = crypto.createHash('md5'),
    encoding = typeof data === 'string' ? 'utf8' : 'binary';
  md5sum.update(data, encoding);
  return md5sum.digest('hex');
}

// --- deploy -----------------------------------------------------------
function deploy (config) {
  // init deploy
  if (fs.existsSync(config.dir._deploy)) {
    fsEx.removeSync(config.dir._deploy);
  }
  fsEx.mkdirsSync(config.dir._deploy);

  // init data
  config._deploy = {
    layout: {},
    style: {},
    script: {}
  };

  // res
  console.log(chalk.yellow('> res file:'));
  var res_pattern = '{' + config.dir._common + ',' + config.dir._module + ',' + config.dir._component + ',' + config.dir._lib + '}/**/!(_*).{' + res_file_pattern + '}';
  var res_files = glob.sync(res_pattern, {});
  res_files.forEach(function (item) {
    item = path.join(item);
    var output_path = getDeployPath(item, config);
    var uri = output_path.replace(config.dir._deploy, '').replace(/\\/ig, '/');

    fsEx.copySync(item, output_path);
    console.log(chalk.gray('  ' + uri), chalk.blue(' -> '), chalk.green('done'));
  });

  // script
  console.log(chalk.yellow('> script file:'));
  var js_pattern = '{' + config.dir._common + ',' + config.dir._module + ',' + config.dir._component + ',' + config.dir._lib + '}/**/!(_*).js';
  var js_files = glob.sync(js_pattern, {});
  js_files.forEach(function (item) {
    item = path.join(item);
    var data = deployScript(item, config);
    config._deploy.script[item] = data;
  });

  // style
  console.log(chalk.yellow('> style file:'));
  var css_pattern = '{' + config.dir._common + ',' + config.dir._module + ',' + config.dir._component + ',' + config.dir._lib + '}/**/!(_*).{css,scss}';
  var css_files = glob.sync(css_pattern, {});
  css_files.forEach(function (item) {
    item = path.join(item);
    var data = deployStyle(item, config);
    config._deploy.style[item.replace(/\.scss$/i, '.css')] = data;
  });

  // layout
  var arr_layout = fs.readdirSync(config.dir._layout);
  arr_layout.forEach(function (item) {
    var absolute_path = path.join(config.dir._layout, item);
    var data = getLayoutData(absolute_path, config);

    config._deploy.layout[absolute_path] = data;
    // var parse = path.parse(absolute_path);
  });

  // module
  console.log(chalk.yellow('> page file:'));
  var html_pattern = config.dir._module + '/**/!(_*).html';
  var html_files = glob.sync(html_pattern, {});
  html_files.forEach(function (item) {
    item = path.join(item);
    var output_path = getDeployPath(item, config);
    var uri = output_path.replace(config.dir._deploy, '').replace(/\\/ig, '/');

    var page_data = getPageData(item, config);
    var page_content = getPageContent(page_data, config);

    fsEx.outputFileSync(output_path, page_content);
    console.log(chalk.gray('  ' + uri), chalk.blue(' -> '), chalk.green('done'));
  });
    // console.log(config._deploy);
};
exports.deploy = deploy;

// var UglifyJS = require("uglify-js");
function deployScript (absolute_path, config) {
  // var result = UglifyJS.minify(absolute_path);
  // var hash = getHash(result.code);
  var result = fs.readFileSync(absolute_path, 'utf8');
  var hash = getHash(result).substr(0,5);

  var output_path = getDeployPath(absolute_path, config);
  var output_parse = path.parse(output_path);
  output_path = path.join(output_parse.dir, (output_parse.name + '-' + hash + output_parse.ext));

  var uri = output_path.replace(config.dir._deploy, '').replace(/\\/ig, '/');

  fsEx.outputFileSync(output_path, result);

  console.log(chalk.gray('  ' + uri), chalk.blue(' -> '), chalk.green('done'));

  return {
    path: output_path,
    uri: uri
  }
}

var CleanCSS = require('clean-css');
var sass = require('node-sass');
function deployStyle (absolute_path, config) {
  var result = '';
  var file_ext = path.extname(absolute_path);

  if (file_ext == '.css') {
    result = fs.readFileSync(absolute_path, 'utf8');
  } else if (file_ext == '.scss') {
    var result = sass.renderSync({
      file: absolute_path,
      outputStyle: 'compressed'
    }, function (err, result) {
      console.log(err);
    });
    result = result.css.toString('utf-8')
    absolute_path = absolute_path.replace(/\.scss$/i, '.css')
  }
  result = new CleanCSS({
    keepSpecialComments: 0
  }).minify(result).styles;

  var hash = getHash(result).substr(0,5);

  var output_path = getDeployPath(absolute_path, config);
  var output_parse = path.parse(output_path);
  output_path = path.join(output_parse.dir, (output_parse.name + '-' + hash + output_parse.ext));

  var uri = output_path.replace(config.dir._deploy, '').replace(/\\/ig, '/');

  fsEx.outputFileSync(output_path, result);

  console.log(chalk.gray('  ' + uri), chalk.blue(' -> '), chalk.green('done'));

  return {
    path: output_path,
    uri: uri
  }
}


function getDeployPath (target_path, config) {
  var file_uri = target_path;
  if (typeof target_path != 'string') return target_path;
  // 是否在common中
  if (target_path.indexOf(config.dir._common) === 0) {
    file_uri = target_path.replace(config.dir._common, '').replace(/\\/ig, '/');
  }
  else if (target_path.indexOf(config.dir._module) === 0) {
    file_uri = target_path.replace(config.dir._module, '').replace(/\\/ig, '/');
  }
  else if (target_path.indexOf(config.dir._component) === 0) {
    file_uri = '/component' + target_path.replace(config.dir._component, '').replace(/\\/ig, '/');
  }
  else if (target_path.indexOf(config.dir._lib) === 0) {
    file_uri = '/lib' + target_path.replace(config.dir._lib, '').replace(/\\/ig, '/');
  }
  else {
    return target_path;
  }
  return path.join(config.dir._deploy, file_uri);
}
