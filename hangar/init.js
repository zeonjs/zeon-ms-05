'use strict';

var chalk = require('chalk');
var path = require('path');
var fs = require('fs-extra');

var assetDir = path.join(__dirname, '../assets');

exports = module.exports = function (args) {
  var baseDir = this.base_dir;
  var userOption = this.user_option;

  fs.copy(assetDir, baseDir, function (err) {
    if (err) return console.error(err)
  	// 遍历生成目录
  	for(var value in userOption.dir){
  		fs.emptyDir(dirs[value],function(err){
  			if (err) console.log('# ' + chalk.red(err));
  		});
    }
    console.log('# ' + chalk.green('MS-05 Zaku') + ' is init.');
  });

};
