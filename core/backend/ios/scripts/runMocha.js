var Mocha = require("mocha")

var mocha = new Mocha({ timeout: 9999999 });

mocha.addFile('main.js')

mocha.run()