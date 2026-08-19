/* File IO tests. Run: node tests/fileio.test.js */
var fs = require("fs");
var path = require("path");
var io = require("../src/fileio.js");

var failures = [];
function check(name, cond) {
  if (!cond) failures.push(name);
  console.log((cond ? "PASS" : "FAIL") + "  " + name);
}

var sample = "# Quarterly Update\n\nThis is the **first** paragraph with plain text.\n\n## Details\n\nSecond paragraph talks about revenue, costs, and margins. It has two sentences.\n\nThird paragraph closes the note.";

(async function () {
  /* DOCX roundtrip */
  var docx = io.toDocx(sample);
  check("docx starts with PK", docx[0] === 0x50 && docx[1] === 0x4B);
  fs.writeFileSync("/tmp/test-out.docx", docx);

  var back = await io.fromDocx(docx);
  check("docx roundtrip keeps heading 1", /^# Quarterly Update/m.test(back));
  check("docx roundtrip keeps heading 2", /^## Details/m.test(back));
  check("docx roundtrip keeps body text", back.indexOf("Second paragraph talks about revenue, costs, and margins.") !== -1);
  check("docx roundtrip keeps bold text content", back.indexOf("first") !== -1);
  check("docx roundtrip paragraph count", back.split(/\n\n/).length === 5);

  /* unzip handles deflated zips too (make one with node zlib via a quick manual zip) */
  var zlib = require("zlib");
  var payload = Buffer.from("hello deflated world");
  var deflated = zlib.deflateRawSync(payload);
  function u16(v) { return Buffer.from([v & 255, v >> 8]); }
  function u32(v) { return Buffer.from([v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]); }
  var crc = zlib.crc32 ? zlib.crc32(payload) : (function () {
    var t = [], c;
    for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    var cc = 0xFFFFFFFF;
    for (var i = 0; i < payload.length; i++) cc = t[(cc ^ payload[i]) & 255] ^ (cc >>> 8);
    return (cc ^ 0xFFFFFFFF) >>> 0;
  })();
  var name = Buffer.from("a.txt");
  var local = Buffer.concat([u32(0x04034B50), u16(20), u16(0), u16(8), u16(0), u16(0), u32(crc), u32(deflated.length), u32(payload.length), u16(name.length), u16(0), name, deflated]);
  var cdir = Buffer.concat([u32(0x02014B50), u16(20), u16(20), u16(0), u16(8), u16(0), u16(0), u32(crc), u32(deflated.length), u32(payload.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(0), name]);
  var eocd = Buffer.concat([u32(0x06054B50), u16(0), u16(0), u16(1), u16(1), u32(cdir.length), u32(local.length), u16(0)]);
  var zipBuf = new Uint8Array(Buffer.concat([local, cdir, eocd]));
  var files = await io.unzip(zipBuf);
  check("unzip inflates deflated entry", new TextDecoder().decode(files["a.txt"]) === "hello deflated world");

  /* PDF output */
  var pdf = io.toPdf(sample);
  var pdfStr = Buffer.from(pdf).toString("latin1");
  check("pdf header", pdfStr.startsWith("%PDF-1.4"));
  check("pdf has EOF", pdfStr.trim().endsWith("%%EOF"));
  check("pdf has Helvetica-Bold for headings", pdfStr.indexOf("Helvetica-Bold") !== -1);
  fs.writeFileSync("/tmp/test-out.pdf", pdf);

  /* longer text paginates */
  var longText = new Array(200).join("This sentence repeats to force pagination across several pages. ");
  var pdf2 = Buffer.from(io.toPdf(longText)).toString("latin1");
  var pageCount = (pdf2.match(/\/Type \/Page[^s]/g) || []).length;
  check("pdf paginates (>1 page)", pageCount > 1);

  /* TXT */
  var txt = io.toTxt(sample);
  check("txt uppercases headings", /^QUARTERLY UPDATE$/m.test(txt));
  check("txt strips bold markers", txt.indexOf("**") === -1);

  /* escaping */
  var tricky = io.toPdf("Parens (like this) and backslash \\ and a dash — plus “smart quotes”.");
  var trickyStr = Buffer.from(tricky).toString("latin1");
  check("pdf escapes parens", trickyStr.indexOf("\\(like this\\)") !== -1);

  var docxTricky = await io.fromDocx(io.toDocx("Ampersand & <angle> \"quotes\""));
  check("docx roundtrip escapes xml", docxTricky.indexOf("Ampersand & <angle> \"quotes\"") !== -1);

  if (failures.length) {
    console.log("\n" + failures.length + " FAILURE(S)");
    process.exit(1);
  }
  console.log("\nAll file IO checks passed.");
})().catch(function (e) { console.error("ERROR:", e); process.exit(1); });
