'use strict';

var _        = require('lodash');
var path     = require('path');
var fs       = require('fs');
var util     = require('util');
var crypto   = require('crypto');
var swig     = require('swig');
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

  // get page content
  var fileContent = fs.readFileSync(filepath, 'utf8');
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
module.exports = exports = renderHTML;


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
  data.content = data.template = fs.readFileSync(layout_path, 'utf8');

  // 替换section节点为swig block
  data.template = data.template.replace(reg.section, function () {
    var type = arguments[2] || arguments[4];
    return '{% block ' + type + ' %}{% endblock %}'
  });

  // 替换img
  data.template = data.template.replace(reg.img, function () {
    var relative_path = arguments[0].match(reg.imgPath)[1];
    var absolute_path = fsHelper.getFilepath(relative_path, config, config.dir._layout);
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

  temp = temp.replace(reg.include, function () {
    var relative_path = arguments[2] ;
    var absolute_path = path.join(path_parse.dir, relative_path);
    var partial_data = getPartialData(absolute_path, config);
    return '';
  });

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
    locals: {
      _root: page_relative_path
    },
    filename: path.join(config.dir._root, encodeURIComponent(page_path))
  });

  return content;
}

function getPageContent (data, config) {
  if (!data.layout) return data._content;

  var path_parse = path.parse(data.path);

  var temp = '';

  // css
  temp += '{% block style %}\n';
  var css_data = unionDataId(data.layout.css, data.css);
  for (var i = 0, l = css_data.length; i < l; i++) {
    temp += css_data[i].content;
  }
  temp += '{% endblock %}\n';

  // js
  temp += '{% block script %}\n';
  var js_data = unionDataId(data.layout.js, data.js);
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
    data.layout = getLayoutData(layout_path, config);
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
    data.content = '<link rel="stylesheet" href="' + setUrlRootParam(absolute_path, config) + '">';

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
    var absolute_path = data.path = path.join(page_path, relative_path);

    data.id = getHash(absolute_path);
    // data.content = content.replace(relative_path, setUrlRootParam(absolute_path, config));
    data.content = '<script src="' + setUrlRootParam(absolute_path, config) + '"></script>';

  } else {
    data.is_external = false;

    data.id = getHash(content);
    data.content = content;
  }

  return data;
}
function getBodyData (content) {
  var body_content = content.match(reg.body)[0];
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

// 获取内容MD5
function getHash (data) {
  var md5sum = crypto.createHash('md5'),
    encoding = typeof data === 'string' ? 'utf8' : 'binary';
  md5sum.update(data, encoding);
  return md5sum.digest('hex');
}
