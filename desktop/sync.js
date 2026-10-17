/* Copies the built app into the Tauri frontend folder.
   The app is ONE self-contained HTML file with no network calls, which is
   why this is a copy and not a bundler. Run from desktop/: node sync.js */
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var src = path.join(root, "app", "mywords.html");
var out = path.join(__dirname, "dist", "index.html");

if (!fs.existsSync(src)) {
  console.error("app/mywords.html is missing. Run `node src/build.js` in the repo root first.");
  process.exit(1);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.copyFileSync(src, out);

var html = fs.readFileSync(out, "utf8");
/* The product's first promise is that nothing leaves the machine. A desktop
   build makes that promise enforceable rather than merely true, so fail the
   build if a remote reference ever appears in the bundle. pdf.js is the one
   known exception and is loaded only when a PDF is opened; vendoring it is
   tracked separately. */
var remote = (html.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+/gi) || [])
  .filter(function (u) { return u.indexOf("cdnjs.cloudflare.com/ajax/libs/pdf.js") === -1; });
if (remote.length) {
  console.error("Remote reference found in the bundle:\n  " + remote.join("\n  "));
  process.exit(1);
}
console.log("Synced app/mywords.html -> dist/index.html (" + Math.round(html.length / 1024) + " KB)");
