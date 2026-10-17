/* Inlines the shared modules into each template and writes the apps.
   Run from repo root: node src/build.js

   One engine, one file-IO layer, one rules layer, one LinkedIn layer. The
   templates differ; nothing below them does. That is the whole point of
   building two apps this way rather than forking one into the other. */
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
function read(f) { return fs.readFileSync(path.join(root, "src", f), "utf8"); }

var parts = {
  "/*__ENGINE__*/": read("engine.js"),
  "/*__FILEIO__*/": read("fileio.js"),
  "/*__RULES__*/": read("rules.js"),
  "/*__LINKEDIN__*/": read("linkedin.js")
};

var apps = [
  { template: "template.html",       out: "index.html", name: "Patralekhiser",
    required: ["/*__ENGINE__*/", "/*__FILEIO__*/"] },
  { template: "template-voice.html", out: "mywords.html", name: "myWords",
    required: ["/*__RULES__*/", "/*__LINKEDIN__*/", "/*__ENGINE__*/", "/*__FILEIO__*/"] }
];

apps.forEach(function (app) {
  var template = read(app.template);
  app.required.forEach(function (ph) {
    if (template.indexOf(ph) === -1) {
      console.error("Placeholder " + ph + " not found in " + app.template + ".");
      process.exit(1);
    }
  });
  var out = template;
  Object.keys(parts).forEach(function (ph) {
    if (out.indexOf(ph) === -1) return;
    out = out.replace(ph, function () { return parts[ph]; });
  });
  fs.writeFileSync(path.join(root, "app", app.out), out);
  console.log("Built app/" + app.out + "  " + app.name + " (" + Math.round(out.length / 1024) + " KB)");
});
