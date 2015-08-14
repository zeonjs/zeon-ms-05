'use strict';

var _      = require('lodash');
var util   = require('util');
var path   = require('path');
var fs     = require('fs');
var crypto = require('crypto');
var fm     = require('zeon-front-matter');
var swig   = require('swig');

// .cache
var Templates = {};

var reg = {
  // sectuib
  section: /(<!--\[section (\S+?)\]\[\/section\]-->)|(<!--\[section (\S+?)\]-->[\s\S]*?<!--\[\/section\]-->)/ig,
  // html body
  body: /<body>([\s\S]*)<\/body>/ig,
  // 匹配link:css标签以及style标签
  css: /(?:[^>\n\r]*)(<link\s*.*href=["'].*\.s?css["'?].*\/?>|<style[^>]*>(?:[\S\s]*?)<\/style>)[\n\r]*/ig,
  // 匹配css文件路径
  cssPath: /href=(?:"|')?([^"' >]+)(?:"|')?/i,
  // 匹配css文件
  cssFile: /(?:[^"' >\/]+)\.s?css(?=["'?])/i,
  // 匹配script标签
  js: /(?:[^>\n\r]*)(<script[^>]*>(?:[\s\S]*?)<\/script\s*>)[\n\r]*/ig,
  // 匹配js文件路径
  jsPath: /^<script[^>]+src=(?:"|')\s*(\S+)\s*(?:"|')/i,
  // 匹配js文件名
  jsFile: /(?:[^"' >\/]+)\.js(?=["'?])/i
}

exports.moduleHTML = function (filepath) {
  var baseDir = this.base_dir || '';
  var config = this.user_option || {};

  var pageDir = path.parse(filepath).dir;
  var pageData = pageRender(filepath, config);

  // read file content
  // var fileContent = fs.readFileSync(filepath, 'utf-8');

  // get data
  // var data = fm.parse(fileContent);

  // layout
  var layout = false;

  if (pageData.fm.hasOwnProperty('layout')) {
    layout = data.layout;
  } else if (config && config.layout && config.layout.default) {
    layout = config.layout.default;
  }

  // if no layout, just render html
  if (!config.layout.enable || !layout) return pageData.content;

  // has layout
  var layoutPath = path.join(baseDir, config.dir.layout, layout + '.html');

  if (fs.existsSync(layoutPath)) {
    var layoutDir = path.join(config.dir._root, config.dir.layout);
    var layoutData = layoutRender(layoutPath, config);
    _layoutRenderer(layoutPath, config);
    // var layoutCode = path.join(baseDir, encodeURIComponent(layoutPath));


    // layout init
    // if (true/*!Templates[layoutCode]*/) {
    //   var layoutContent = fs.readFileSync(layoutPath, 'utf-8');

    //   var template = '';

    //   // section
    //   template = layoutContent.replace(reg.section, function () {
    //     var type = arguments[2] || arguments[4];
    //     return '{% block ' + type + ' %}{% endblock %}'
    //   });

    //   Templates[layoutCode] = template;
    //   swig.setDefaults({ loader: swig.loaders.memory(Templates) });
    // }

    // module content
    // var originContent = data._content;
    var moduleDate = {};
    var layoutCode = path.join(baseDir, encodeURIComponent(layoutData.absolutePath));
    var moduleContent = '{% extends "' + layoutCode + '" %}';
    // css
    moduleDate.css = [];
    var cssMD5 = _.uniq(layoutData.css.md5.concat(pageData.css.md5));
    cssMD5.map(function (item) {
      var curData = pageData.css.list[item] || layoutData.css.list[item];
      if (curData.type === 0) {
        moduleDate.css.push(curData.content);
      } else {
        var cssRelative = path.relative(pageDir, curData.content).replace(/\\/ig, '/');
        moduleDate.css.push(util.format('<link rel="stylesheet" href="%s">', cssRelative));
      }
    });
    moduleContent += '{% block style %}' + moduleDate.css.join('\n') + '{% endblock %}';

    // js
    moduleDate.js = [];
    var jsMD5 = _.uniq(layoutData.js.md5.concat(pageData.js.md5));
    jsMD5.map(function (item) {
      var curData = pageData.js.list[item] || layoutData.js.list[item];
      if (curData.type === 0) {
        moduleDate.js.push(curData.content);
      } else {
        var jsRelative = path.relative(pageDir, curData.content).replace(/\\/ig, '/');
        moduleDate.js.push(util.format('<script src="%s"></script>', jsRelative));
      }
    });
    moduleContent += '{% block script %}' + moduleDate.js.join('\n') + '{% endblock %}';

    // body
    var bodyContent = pageData.content;
    bodyContent = bodyContent.replace(/^<body>/ig, '').replace(/<\/body>$/ig, '');
    moduleContent += '{% block content %}' + bodyContent + '{% endblock %}';

    var content = swig.render(moduleContent,{
      filename: path.join(config.dir._root, encodeURIComponent(filepath)),
      loader: swig.loaders.memory({
        layoutCode: layoutData.template
      })
    });


    return content;

  } else {
    return pageData.content;
  }
};

// generator templete
function layoutRender (layoutPath, config) {
  var data = {
    content: '',
    template: '',
    css: {
      md5: [],
      list: {}
    },
    js: {
      md5: [],
      list: {}
    },
    absolutePath: layoutPath
  };

  var layoutFolder = path.join(config.dir._root, config.dir.layout);

  data.content = data.template = fs.readFileSync(layoutPath, 'utf-8');

  // section
  data.template = data.template.replace(reg.section, function () {
    var type = arguments[2] || arguments[4];
    return '{% block ' + type + ' %}{% endblock %}'
  });

  // css
  var cssData = formatCss(data.template.match(reg.css), layoutFolder);
  if (cssData) data.css = cssData;
  data.template.replace(reg.css, '');

  // js
  var jsData = formatJs(data.template.match(reg.js), layoutFolder);
  if (jsData) data.js = jsData;
  data.template.replace(reg.js, '');

  return data;
}
// render page
function pageRender (pagePath, config) {
  var data = {
    content: '',
    template: '',
    css: {
      md5: [],
      list: {}
    },
    js: {
      md5: [],
      list: {}
    },
    body: '',
    absolutePath: pagePath,
    fm: {}
  };
  var _temp = '';
  var pathData = path.parse(pagePath);


  var fileContent = fs.readFileSync(pagePath, 'utf-8');
  data.fm = fm.parse(fileContent);
  data.content = _temp = data.fm._content;

  // css
  var cssData = formatCss(_temp.match(reg.css), pathData.dir);
  if (cssData) data.css = cssData;
  _temp.replace(reg.css, '');

  // js
  var jsData = formatJs(_temp.match(reg.js), pathData.dir);
  if (jsData) data.js = jsData;
  _temp.replace(reg.js, '');

  // body
  _temp = _temp.replace(reg.body, function () {
    data.content = arguments[1];
    return '';
  });

  return data;
}

// format content
function formatCss (cssList, basePath) {
  var data = {
    md5: [],
    list: {}
  }

  // loop
  for (var i in cssList) {
    var curItem = cssList[i];
    var curData = {};
    var curHash = '';

    if (reg.cssPath.test(curItem)) {
      // 外部样式
      curData.type = 1;
      curData.content = path.join(basePath, curItem.match(reg.cssPath)[1]);
    } else {
      // 内部样式
      curData.type = 0;
      curData.content = curItem;
    }
    curHash = getHash(curData.content);

    data.md5.push(curHash);
    data.list[curHash] = curData;
  }

  return data;
}
function formatJs (jsList, basePath) {
  var data = {
    md5: [],
    list: {}
  }

  // loop
  for (var i in jsList) {
    var curItem = jsList[i];
    var curData = {};
    var curHash = '';

    if (reg.jsPath.test(curItem)) {
      // outside
      curData.type = 1;
      curData.content = path.join(basePath, curItem.match(reg.jsPath)[1]);
    } else {
      // inside
      curData.type = 0;
      curData.content = curItem;
    }
    curHash = getHash(curData.content);

    data.md5.push(curHash);
    data.list[curHash] = curData;
  }
  // console.log(data);
  return data;
}


//==============================================================================================

// 模板渲染
function _layoutRenderer (layout_path, config) {
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

  console.log(data.template);
  return data;
}

// 页面渲染
function _pageRenderer (page_path, config) {
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
  return '{{_root}}' + file_uri;
}

function getHash (data) {
  var md5sum = crypto.createHash('md5'),
    encoding = typeof data === 'string' ? 'utf8' : 'binary';
  md5sum.update(data, encoding);
  return md5sum.digest('hex');
};
