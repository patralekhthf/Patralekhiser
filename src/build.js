/* Inlines the engine into the template and writes app/index.html.
   Run from repo root: node src/build.js */
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var engine = fs.readFileSync(path.join(root, "src", "engine.js"), "utf8");
var template = fs.readFileSync(path.join(root, "src", "template.html"), "utf8");

if (template.indexOf("/*__ENGINE__*/") === -1) {
  console.error("Placeholder /*__ENGINE__*/ not found in template.");
  process.exit(1);
}

var out = template.replace("/*__ENGINE__*/", function () { return engine; });
fs.writeFileSync(path.join(root, "app", "index.html"), out);
console.log("Built app/index.html (" + Math.round(out.length / 1024) + " KB)");
