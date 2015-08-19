'use strict';

var _      = require('lodash');
var util   = require('util');
var path   = require('path');
var fs     = require('fs');
var crypto = require('crypto');
var fm     = require('zeon-front-matter');
var swig   = require('swig');

var reg = {
  // sectuib
  section: /(<!--\[section (\S+?)\]\[\/section\]-->)|(<!--\[section (\S+?)\]-->[\s\S]*?<!--\[\/section\]-->)/ig,
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

/**
 * 渲染页面
 * @param  {string} filepath 页面路径
 * @return {string}          页面内容
 */
exports.renderHTML = function (filepath) {
  var baseDir = this.base_dir || '';
  var config = this.user_option || {};

  // get page content
  var fileContent = fs.readFileSync(filepath, 'utf-8');
  var page_data = fm.parse(fileContent);
  var page_content = page_data._content;

  // layout
  var layout = false;
  if (page_data.hasOwnProperty('layout')) {
    layout = page_data.layout;
  } else if (config && config.layout && config.layout.default) {
    layout = config.layout.default;
  }

  // if no layout, just render html
  if (!config.layout.enable || !layout) return page_content;

  // has layout
  var layoutPath = path.join(baseDir, config.dir.layout, layout + '.html');

  if (fs.existsSync(layoutPath)) {
    var layout_data = layoutRenderer(layoutPath, config);
    return pageRendererWithLayout(filepath, page_content, layout_data, config);
  } else {
    return page_content;
  }

};


//==============================================================================================

// 模板渲染
function layoutRenderer (layout_path, config) {
  // 数据对象
  var data = {
    content: '',
    template: '',
    css: {
      md5: [],
      list: [],
      path: []
    },
    js: {
      md5: [],
      list: [],
      path: []
    },
    absolute_path: layout_path
  };
  // 路径参数
  var path_parse = path.parse(layout_path);

  // 获取内容
  data.content = data.template = fs.readFileSync(layout_path, 'utf-8');

  // 替换section节点为swig block
  data.template = data.template.replace(reg.section, function () {
    var type = arguments[2] || arguments[4];
    return '{% block ' + type + ' %}{% endblock %}'
  });

  // 替换img
  data.template = data.template.replace(reg.img, function () {
    var relative_path = arguments[0].match(reg.imgPath)[1];
    var absolute_path = path.join(config.dir._layout, relative_path);
    var path_with_root = setUrlRootParam(absolute_path, config);
    return arguments[0].replace(relative_path, path_with_root);
  });

  // 提取css信息
  data.template = data.template.replace(reg.css, function () {
    var current_data = {}
    var content = arguments[0];

    var result = '';

    if (reg.cssPath.test(arguments[1])) {
      // 外部样式
      var href = arguments[0].match(reg.cssPath)[1];

      current_data.type = 1;
      current_data.absolute_path = path.join(path_parse.dir, href);

      data.css.path.push(current_data.absolute_path);

      var tmpl_url = setUrlRootParam(current_data.absolute_path, config);

      result = arguments[0].replace(href, tmpl_url);

    } else {
      // 内部样式
      current_data.type = 0;
      current_data.content = content;
      result = content;
    }
    data.css.list.push(current_data);
    return result;
  });

  // 提取js信息
  data.template = data.template.replace(reg.js, function () {
    var current_data = {}
    var content = arguments[0];

    var result = '';

    if (reg.jsPath.test(arguments[1])) {
      // 外部样式
      var href = arguments[0].match(reg.jsPath)[1];

      current_data.type = 1;
      current_data.absolute_path = path.join(path_parse.dir, href);

      data.js.path.push(current_data.absolute_path);

      var tmpl_url = setUrlRootParam(current_data.absolute_path, config);

      result = arguments[0].replace(href, tmpl_url);

    } else {
      // 内部样式
      current_data.type = 0;
      current_data.content = content;
      result = content;
    }
    data.js.list.push(current_data);
    return result;
  });

  return data;
}

// 页面渲染
function pageRendererWithLayout (page_path, page_content, layout_data, config) {
  var path_parse = path.parse(page_path);
  var data = '';
  var temp = page_content;

  // css
  var css_data = [];
  temp = temp.replace(reg.css, function () {
    if (reg.cssPath.test(arguments[1])) {
      // 外部样式
      var relative_path = arguments[0].match(reg.cssPath)[1];
      var absolute_path = path.join(path_parse.dir, relative_path);

      if (!_.includes(layout_data.css.path, absolute_path)) {
        var root_path = setUrlRootParam(absolute_path, config);
        css_data.push(arguments[0].replace(relative_path, root_path));
      }

    } else {
      // 内部样式
      css_data.push(arguments[0]);
    }
    return '';
  });
  data += '{% block style %}\n' + css_data.join('') + '{% endblock %}\n';

  // js
  var js_data = [];
  temp = temp.replace(reg.js, function () {
    if (reg.jsPath.test(arguments[1])) {
      // 外部样式
      var relative_path = arguments[0].match(reg.jsPath)[1];
      var absolute_path = path.join(path_parse.dir, relative_path);

      if (!_.includes(layout_data.js.path, absolute_path)) {
        var root_path = setUrlRootParam(absolute_path, config);
        js_data.push(arguments[0].replace(relative_path, root_path));
      }

    } else {
      // 内部样式
      js_data.push(arguments[0]);
    }
    return '';
  });
  data += '{% block script %}\n' + js_data.join('') + '{% endblock %}\n';

  // body
  var body_content = temp.match(reg.body)[0];
  body_content = body_content.replace(/^<body>/ig, '').replace(/<\/body>$/ig, '');
  data += '{% block content %}\n' + body_content + '\n{% endblock %}\n';

  // swig render
  var layout_code = path.join(config.dir._root, encodeURIComponent(layout_data.absolute_path));

  data = '{% extends "' + layout_code + '" %}\n' + data;

  var template = {};
  template[layout_code] = layout_data.template;
  swig.invalidateCache();
  swig.setDefaults({ loader: swig.loaders.memory(template) });

  var page_relative_path = path.relative(path_parse.dir, config.dir._module);
  page_relative_path == '' ? page_relative_path = '.' : null;
  page_relative_path = page_relative_path.replace(/\\/ig, '/');

  var content = swig.render(data, {
    varControls: ['{$', '$}'],
    locals: {
      _root: page_relative_path
    },
    filename: path.join(config.dir._root, encodeURIComponent(page_path))
  });

  return content;
}

//==============================================================================================


// 添加root参数
function setUrlRootParam (target_path, config) {
  var file_uri = target_path;
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

function getHash (data) {
  var md5sum = crypto.createHash('md5'),
    encoding = typeof data === 'string' ? 'utf8' : 'binary';
  md5sum.update(data, encoding);
  return md5sum.digest('hex');
};
