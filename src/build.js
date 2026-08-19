/* Inlines the engine into the template and writes app/index.html.
   Run from repo root: node src/build.js */
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var engine = fs.readFileSync(path.join(root, "src", "engine.js"), "utf8");
var fileio = fs.readFileSync(path.join(root, "src", "fileio.js"), "utf8");
var template = fs.readFileSync(path.join(root, "src", "template.html"), "utf8");

["/*__ENGINE__*/", "/*__FILEIO__*/"].forEach(function (ph) {
  if (template.indexOf(ph) === -1) {
    console.error("Placeholder " + ph + " not found in template.");
    process.exit(1);
  }
});

var out = template
  .replace("/*__ENGINE__*/", function () { return engine; })
  .replace("/*__FILEIO__*/", function () { return fileio; });
fs.writeFileSync(path.join(root, "app", "index.html"), out);
console.log("Built app/index.html (" + Math.round(out.length / 1024) + " KB)");
