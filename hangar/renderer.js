'use strict';

var path = require('path');
var fs   = require('fs');
var fm   = require('zeon-front-matter');
var swig = require('swig');

// .cache
var Templates = {};

var reg = {
  // sectuib
  section: /(<!--\[section (\S+?)\]\[\/section\]-->)|(<!--\[section (\S+?)\]-->[\s\S]*?<!--\[\/section\]-->)/ig,
  // html body
  body: /<body>([\s\S]*)<\/body>/ig,
  // 匹配link:css标签以及style标签
  css: /(?:[^>\n\r]*)(<link\s*.*href=["'].*\.css["'?].*\/?>|<style[^>]*>(?:[\S\s]*?)<\/style>)[\n\r]*/ig,
  // 匹配css文件路径
  cssPath: /href=(?:"|')?([^"' >]+)(?:"|')?/i,
  // 匹配css文件
  cssFile: /(?:[^"' >\/]+)\.css(?=["'?])/i,
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

  // read file content
  var fileContent = fs.readFileSync(filepath, 'utf-8');

  // get data
  var data = fm.parse(fileContent);

  // layout
  var layout = false;

  if (data.hasOwnProperty('layout')) {
    layout = data.layout;
  } else if (config && config.layout && config.layout.default) {
    layout = config.layout.default;
  }

  // if no layout, just render html
  if (!config.layout.enable || !layout) return data._content;

  // has layout
  var layoutPath = path.join(baseDir, config.dir.layout, layout + '.html');

  if (fs.existsSync(layoutPath)) {
    var layoutCode = path.join(baseDir, encodeURIComponent(layoutPath));
    var layoutData = {};

    // layout init
    if (true/*!Templates[layoutCode]*/) {
      var layoutContent = fs.readFileSync(layoutPath, 'utf-8');

      var template = '';

      // section
      template = layoutContent.replace(reg.section, function () {
        var type = arguments[2] || arguments[4];
        return '{% block ' + type + ' %}{% endblock %}'
      });

      Templates[layoutCode] = template;
      swig.setDefaults({ loader: swig.loaders.memory(Templates) });
    }

    // module content
    var originContent = data._content;
    var moduleDate = {};
    var moduleContent = '{% extends "' + layoutCode + '" %}';
    // css
    moduleDate.css = [];
    originContent = originContent.replace(reg.css, function () {
      moduleDate.css.push(arguments[1]);
      return '';
    });
    moduleContent += '{% block style %}' + moduleDate.css.join('\n') + '{% endblock %}';
    // js
    moduleDate.js = [];
    originContent = originContent.replace(reg.js, function () {
      moduleDate.js.push(arguments[1]);
      return '';
    });
    moduleContent += '{% block script %}' + moduleDate.js.join('\n') + '{% endblock %}';
    // body
    var bodyContent = originContent.match(reg.body)[0];
    bodyContent = bodyContent.replace(/^<body>/ig, '').replace(/<\/body>$/ig, '');
    moduleContent += '{% block content %}' + bodyContent + '{% endblock %}';

    var content = swig.render(moduleContent,{
      filename: path.join(baseDir, encodeURIComponent(filepath))
    });

    return content;

  } else {
    return data._content;
  }
};
