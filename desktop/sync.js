/* Copies the built app into the Tauri frontend folder.
   The app is ONE self-contained HTML file with no network calls, which is
   why this is a copy and not a bundler. Run from desktop/: node sync.js */
var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var src = path.join(root, "app", "swara.html");
var out = path.join(__dirname, "dist", "index.html");

if (!fs.existsSync(src)) {
  console.error("app/swara.html is missing. Run `node src/build.js` in the repo root first.");
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
/* A CSP and inline event handlers cannot coexist in a Tauri app. Tauri adds
   a nonce to script-src, and the CSP spec says a nonce makes 'unsafe-inline'
   be ignored, so every onclick in the page stops firing. The window still
   opens and still looks right, which is what makes it expensive to find:
   it cost a bug report last time. Fail the build instead. */
var conf = JSON.parse(fs.readFileSync(path.join(__dirname, "src-tauri", "tauri.conf.json"), "utf8"));
var csp = conf.app && conf.app.security ? conf.app.security.csp : null;
var inlineHandlers = (html.match(/\son[a-z]+\s*=\s*"/gi) || []).length;
if (csp && inlineHandlers > 0) {
  console.error("tauri.conf.json sets a Content-Security-Policy and the page uses " +
    inlineHandlers + " inline event handlers.");
  console.error("Tauri adds a nonce to script-src, which makes 'unsafe-inline' be ignored,");
  console.error("so none of those handlers will fire and every button will be dead.");
  console.error("See desktop/src-tauri/README.md. Remove the csp, or remove the handlers.");
  process.exit(1);
}

/* Tauri passes productName into bundle_dmg.sh unquoted, so a name holding a
   space-dash-space is split and the tail is read as a flag. It fails on
   every platform, not just this machine. See src-tauri/README.md. */
var product = conf.productName || "";
if (/\s-\s/.test(product) || /^-|\s-$/.test(product)) {
  console.error('productName "' + product + '" contains a dash surrounded by spaces.');
  console.error("Tauri passes it unquoted to bundle_dmg.sh, so the dmg step will fail.");
  console.error("Put the full name in app.windows[].title instead.");
  process.exit(1);
}

console.log("Synced app/swara.html -> dist/index.html (" + Math.round(html.length / 1024) + " KB)" +
  (inlineHandlers ? ", " + inlineHandlers + " inline handlers, no CSP" : ""));
