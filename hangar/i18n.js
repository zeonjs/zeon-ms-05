var fs = require('fs');
var path = require('path');
var walk = require('walk');
var YAML = require('yamljs');
var ejs = require('ejs');

var getLang = function(type) {
  var self = this;
  var lang = {};
  var langPath = self.user_option.dir._lang;
  langPath = path.join(langPath, type)

  fs.readdirSync(langPath).forEach(function(part){
    walk(path.join(langPath, part), lang);
  });
// console.log(lang);
  return lang;
};

var walk = function (uri, list) {
  var stat = fs.lstatSync(uri);
  //var filename = uri.match(/[^\\][\w\d\_]+(?=\.json)/);
  // var filename = uri.match(/[^\\][\w\d\_\.]+$/);
  var filename = uri.match(/[^\\]+$/);

  filename = filename ? filename[0] : null;

  if(stat.isFile()){
    filename = filename.replace(/\.[\w\d]+$/, '');
    var content = YAML.load(uri);
    list[filename] = extend(true, {}, list[filename], content);
  }
  if(list == null || stat.isDirectory()){
    var json = list[filename] = {}
    fs.readdirSync(uri).forEach(function(part){
      walk(path.join(uri, part), json);
    });
  }
};

var getContent = function (content) {
  var self = this;
  var type = self.user_option.lang;
  var lang = getLang.call(this, type);

  var result = ejs.render(content, {
    lang: lang
  });
  return result;
};

var readContent = function (url) {
  var self = this;
  if (fs.existsSync(url)) {
    return getContent.call(self, fs.readFileSync(url, 'utf8'));
  } else {
    return null;
  }
};

module.exports = exports = getContent

exports.read = readContent;



function extend() {
    var options, name, src, copy, copyIsArray, clone, target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false,
        toString = Object.prototype.toString,
        hasOwn = Object.prototype.hasOwnProperty,
        push = Array.prototype.push,
        slice = Array.prototype.slice,
        trim = String.prototype.trim,
        indexOf = Array.prototype.indexOf,
        class2type = {
            "[object Boolean]": "boolean",
            "[object Number]": "number",
            "[object String]": "string",
            "[object Function]": "function",
            "[object Array]": "array",
            "[object Date]": "date",
            "[object RegExp]": "regexp",
            "[object Object]": "object"
        },
        jQuery = {
            isFunction: function(obj) {
                return jQuery.type(obj) === "function"
            },
            isArray: Array.isArray ||
                function(obj) {
                    return jQuery.type(obj) === "array"
                },
            isWindow: function(obj) {
                return obj != null && obj == obj.window
            },
            isNumeric: function(obj) {
                return !isNaN(parseFloat(obj)) && isFinite(obj)
            },
            type: function(obj) {
                return obj == null ? String(obj) : class2type[toString.call(obj)] || "object"
            },
            isPlainObject: function(obj) {
                if (!obj || jQuery.type(obj) !== "object" || obj.nodeType) {
                    return false
                }
                try {
                    if (obj.varructor && !hasOwn.call(obj, "varructor") && !hasOwn.call(obj.varructor.prototype, "isPrototypeOf")) {
                        return false
                    }
                } catch (e) {
                    return false
                }
                var key;
                for (key in obj) {}
                return key === undefined || hasOwn.call(obj, key)
            }
        };
    if (typeof target === "boolean") {
        deep = target;
        target = arguments[1] || {};
        i = 2;
    }
    if (typeof target !== "object" && !jQuery.isFunction(target)) {
        target = {}
    }
    if (length === i) {
        target = this;
        --i;
    }
    for (i; i < length; i++) {
        if ((options = arguments[i]) != null) {
            for (name in options) {
                src = target[name];
                copy = options[name];
                if (target === copy) {
                    continue
                }
                if (deep && copy && (jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)))) {
                    if (copyIsArray) {
                        copyIsArray = false;
                        clone = src && jQuery.isArray(src) ? src : []
                    } else {
                        clone = src && jQuery.isPlainObject(src) ? src : {};
                    }
                    // WARNING: RECURSION
                    target[name] = extend(deep, clone, copy);
                } else if (copy !== undefined) {
                    target[name] = copy;
                }
            }
        }
    }
    return target;
}
