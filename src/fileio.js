/*
 * Patralekhiser file input/output
 * Reads .docx, .md, .txt (and .pdf via lazily loaded pdf.js).
 * Writes .docx, .pdf, .txt, .md.
 * The zip, docx and pdf code is self contained: no libraries, no network.
 * Runs in the browser and in Node 18+ (module.exports guarded at the bottom).
 */

var MyridiusFileIO = (function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* CRC32 (for zip)                                                      */
  /* ------------------------------------------------------------------ */

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* ------------------------------------------------------------------ */
  /* Minimal ZIP writer (stored entries, valid zip, Word opens it)        */
  /* ------------------------------------------------------------------ */

  function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
  function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }

  function zipStore(files) {
    /* files: [{ name: string, data: Uint8Array }] */
    var chunks = [];
    var central = [];
    var offset = 0;
    var enc = new TextEncoder();

    for (var i = 0; i < files.length; i++) {
      var name = enc.encode(files[i].name);
      var data = files[i].data;
      var crc = crc32(data);
      var local = new Uint8Array([].concat(
        u32(0x04034B50), u16(20), u16(0), u16(0), u16(0), u16(0x21),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0)
      ));
      chunks.push(local, name, data);
      central.push({ name: name, crc: crc, size: data.length, offset: offset });
      offset += local.length + name.length + data.length;
    }

    var cdStart = offset;
    for (var j = 0; j < central.length; j++) {
      var e = central[j];
      var hdr = new Uint8Array([].concat(
        u32(0x02014B50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x21),
        u32(e.crc), u32(e.size), u32(e.size), u16(e.name.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(e.offset)
      ));
      chunks.push(hdr, e.name);
      offset += hdr.length + e.name.length;
    }
    var eocd = new Uint8Array([].concat(
      u32(0x06054B50), u16(0), u16(0), u16(central.length), u16(central.length),
      u32(offset - cdStart), u32(cdStart), u16(0)
    ));
    chunks.push(eocd);

    var total = 0;
    chunks.forEach(function (c) { total += c.length; });
    var out = new Uint8Array(total);
    var pos = 0;
    chunks.forEach(function (c) { out.set(c, pos); pos += c.length; });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Minimal ZIP reader (stored + deflated entries)                       */
  /* ------------------------------------------------------------------ */

  function rd16(b, o) { return b[o] | (b[o + 1] << 8); }
  function rd32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

  function inflateRaw(data) {
    var ds = new DecompressionStream("deflate-raw");
    var stream = new Blob([data]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (ab) {
      return new Uint8Array(ab);
    });
  }

  function unzip(buf) {
    /* find end of central directory */
    var eocd = -1;
    var min = Math.max(0, buf.length - 65558);
    for (var i = buf.length - 22; i >= min; i--) {
      if (rd32(buf, i) === 0x06054B50) { eocd = i; break; }
    }
    if (eocd === -1) return Promise.reject(new Error("Not a zip file"));
    var count = rd16(buf, eocd + 10);
    var cdOff = rd32(buf, eocd + 16);

    var dec = new TextDecoder();
    var promises = [];
    var names = [];
    var p = cdOff;
    for (var n = 0; n < count; n++) {
      if (rd32(buf, p) !== 0x02014B50) break;
      var method = rd16(buf, p + 10);
      var compSize = rd32(buf, p + 20);
      var nameLen = rd16(buf, p + 28);
      var extraLen = rd16(buf, p + 30);
      var commentLen = rd16(buf, p + 32);
      var localOff = rd32(buf, p + 42);
      var name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
      /* local header tells the real data start */
      var lNameLen = rd16(buf, localOff + 26);
      var lExtraLen = rd16(buf, localOff + 28);
      var dataStart = localOff + 30 + lNameLen + lExtraLen;
      var raw = buf.subarray(dataStart, dataStart + compSize);
      names.push(name);
      promises.push(method === 8 ? inflateRaw(raw) : Promise.resolve(new Uint8Array(raw)));
      p += 46 + nameLen + extraLen + commentLen;
    }
    return Promise.all(promises).then(function (datas) {
      var out = {};
      for (var k = 0; k < names.length; k++) out[names[k]] = datas[k];
      return out;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Markdown-ish text -> paragraph model                                 */
  /* ------------------------------------------------------------------ */

  function parseDoc(text) {
    var paras = String(text).replace(/\r\n/g, "\n").split(/\n\s*\n/);
    var out = [];
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i].trim();
      if (!p) continue;
      var level = 0;
      var m = p.match(/^(#{1,6})\s+/);
      if (m) { level = Math.min(m[1].length, 3); p = p.replace(/^#{1,6}\s+/, ""); }
      p = p.replace(/\n/g, " ");
      var runs = [];
      var parts = p.split(/\*\*([^*]+)\*\*/);
      for (var j = 0; j < parts.length; j++) {
        if (!parts[j]) continue;
        runs.push({ text: parts[j], bold: j % 2 === 1 });
      }
      if (!runs.length) runs.push({ text: p, bold: false });
      out.push({ level: level, runs: runs });
    }
    return out;
  }

  function plainText(text) {
    return parseDoc(text).map(function (p) {
      return p.runs.map(function (r) { return r.text; }).join("");
    }).join("\n\n");
  }

  /* ------------------------------------------------------------------ */
  /* DOCX writer                                                          */
  /* ------------------------------------------------------------------ */

  function xmlEscape(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  var W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

  function toDocx(text) {
    var paras = parseDoc(text);
    var body = "";
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      var pr = p.level ? "<w:pPr><w:pStyle w:val=\"Heading" + p.level + "\"/></w:pPr>" : "";
      var runs = "";
      for (var j = 0; j < p.runs.length; j++) {
        var r = p.runs[j];
        runs += "<w:r>" + (r.bold ? "<w:rPr><w:b/></w:rPr>" : "") +
                "<w:t xml:space=\"preserve\">" + xmlEscape(r.text) + "</w:t></w:r>";
      }
      body += "<w:p>" + pr + runs + "</w:p>";
    }

    var documentXml =
      "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
      "<w:document xmlns:w=\"" + W_NS + "\"><w:body>" + body +
      "<w:sectPr><w:pgSz w:w=\"12240\" w:h=\"15840\"/>" +
      "<w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\"/></w:sectPr>" +
      "</w:body></w:document>";

    function headingStyle(n, sz) {
      return "<w:style w:type=\"paragraph\" w:styleId=\"Heading" + n + "\">" +
        "<w:name w:val=\"heading " + n + "\"/><w:basedOn w:val=\"Normal\"/>" +
        "<w:pPr><w:spacing w:before=\"240\" w:after=\"120\"/><w:outlineLvl w:val=\"" + (n - 1) + "\"/></w:pPr>" +
        "<w:rPr><w:b/><w:sz w:val=\"" + sz + "\"/><w:szCs w:val=\"" + sz + "\"/></w:rPr></w:style>";
    }

    var stylesXml =
      "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
      "<w:styles xmlns:w=\"" + W_NS + "\">" +
      "<w:style w:type=\"paragraph\" w:default=\"1\" w:styleId=\"Normal\"><w:name w:val=\"Normal\"/>" +
      "<w:rPr><w:sz w:val=\"22\"/><w:szCs w:val=\"22\"/></w:rPr></w:style>" +
      headingStyle(1, "32") + headingStyle(2, "28") + headingStyle(3, "24") +
      "</w:styles>";

    var contentTypes =
      "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
      "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
      "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
      "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
      "<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>" +
      "<Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/>" +
      "</Types>";

    var rels =
      "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
      "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
      "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>" +
      "</Relationships>";

    var docRels =
      "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
      "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
      "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>" +
      "</Relationships>";

    var enc = new TextEncoder();
    return zipStore([
      { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
      { name: "_rels/.rels", data: enc.encode(rels) },
      { name: "word/document.xml", data: enc.encode(documentXml) },
      { name: "word/_rels/document.xml.rels", data: enc.encode(docRels) },
      { name: "word/styles.xml", data: enc.encode(stylesXml) }
    ]);
  }

  /* ------------------------------------------------------------------ */
  /* DOCX reader                                                          */
  /* ------------------------------------------------------------------ */

  function xmlUnescape(s) {
    return s.replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(parseInt(d, 10)); })
            .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
            .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  }

  function fromDocx(buf) {
    return unzip(buf).then(function (files) {
      var xmlBytes = files["word/document.xml"];
      if (!xmlBytes) throw new Error("No word/document.xml found. Is this a .docx file?");
      var xml = new TextDecoder().decode(xmlBytes);
      var paras = [];
      var re = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>|<w:p(?:\s[^>]*)?\/>/g;
      var m;
      while ((m = re.exec(xml)) !== null) {
        var body = m[1] || "";
        var prefix = "";
        var sm = body.match(/<w:pStyle[^>]*w:val="(?:Heading|heading)\s*(\d)"/);
        if (sm) prefix = new Array(Math.min(3, parseInt(sm[1], 10)) + 1).join("#") + " ";
        var texts = [];
        var tre = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
        var tm;
        while ((tm = tre.exec(body)) !== null) {
          if (tm[0] === "<w:tab/>") texts.push(" ");
          else if (tm[0] === "<w:br/>") texts.push("\n");
          else texts.push(xmlUnescape(tm[1]));
        }
        var joined = texts.join("");
        paras.push(joined.trim() ? prefix + joined : "");
      }
      /* collapse runs of empty paragraphs; join with blank lines */
      var out = [];
      for (var i = 0; i < paras.length; i++) {
        if (paras[i]) out.push(paras[i]);
      }
      return out.join("\n\n");
    });
  }

  /* ------------------------------------------------------------------ */
  /* PDF writer (Letter, Helvetica, headings bold and larger)             */
  /* ------------------------------------------------------------------ */

  var WINANSI = { "‘": 145, "’": 146, "“": 147, "”": 148, "–": 150, "—": 151, "…": 133, "•": 149 };

  function pdfEncode(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (WINANSI[s[i]]) code = WINANSI[s[i]];
      if (code > 255) code = 63; /* ? */
      var ch = String.fromCharCode(code);
      if (ch === "\\" || ch === "(" || ch === ")") out += "\\" + ch;
      else out += ch;
    }
    return out;
  }

  function toPdf(text) {
    var paras = parseDoc(text);
    var PAGE_W = 612, PAGE_H = 792, MARGIN = 60;
    var maxWidth = PAGE_W - 2 * MARGIN;

    /* flatten paragraphs to wrapped lines */
    var lines = [];
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      var size = p.level === 1 ? 17 : p.level === 2 ? 14.5 : p.level === 3 ? 12.5 : 11;
      var bold = p.level > 0;
      var flat = p.runs.map(function (r) { return r.text; }).join("");
      var wordsArr = flat.split(/\s+/).filter(Boolean);
      var line = "";
      var charW = size * 0.5;
      for (var w = 0; w < wordsArr.length; w++) {
        var attempt = line ? line + " " + wordsArr[w] : wordsArr[w];
        if (attempt.length * charW > maxWidth && line) {
          lines.push({ text: line, size: size, bold: bold, gap: 0 });
          line = wordsArr[w];
        } else {
          line = attempt;
        }
      }
      if (line) lines.push({ text: line, size: size, bold: bold, gap: 1 });
    }

    /* paginate */
    var pages = [];
    var current = [];
    var y = PAGE_H - MARGIN;
    for (var L = 0; L < lines.length; L++) {
      var lh = lines[L].size * 1.45;
      if (y - lh < MARGIN) { pages.push(current); current = []; y = PAGE_H - MARGIN; }
      y -= lh;
      current.push({ text: lines[L].text, size: lines[L].size, bold: lines[L].bold, y: y });
      if (lines[L].gap) y -= lines[L].size * 0.6;
    }
    if (current.length) pages.push(current);
    if (!pages.length) pages.push([]);

    /* build objects */
    var objects = [];
    function addObj(content) { objects.push(content); return objects.length; }

    var catalogId = addObj(null);   /* placeholder, filled after pages known */
    var pagesId = addObj(null);
    var fontId = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    var fontBoldId = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

    var pageIds = [];
    for (var pg = 0; pg < pages.length; pg++) {
      var ops = "BT\n";
      var curFont = "";
      for (var li = 0; li < pages[pg].length; li++) {
        var ln = pages[pg][li];
        var f = (ln.bold ? "/F2 " : "/F1 ") + ln.size + " Tf";
        if (f !== curFont) { ops += f + "\n"; curFont = f; }
        ops += "1 0 0 1 " + MARGIN + " " + ln.y.toFixed(1) + " Tm (" + pdfEncode(ln.text) + ") Tj\n";
      }
      ops += "ET";
      var contentId = addObj("<< /Length " + ops.length + " >>\nstream\n" + ops + "\nendstream");
      var pageId = addObj("<< /Type /Page /Parent " + pagesId + " 0 R /MediaBox [0 0 " + PAGE_W + " " + PAGE_H + "] " +
        "/Resources << /Font << /F1 " + fontId + " 0 R /F2 " + fontBoldId + " 0 R >> >> " +
        "/Contents " + contentId + " 0 R >>");
      pageIds.push(pageId);
    }

    objects[catalogId - 1] = "<< /Type /Catalog /Pages " + pagesId + " 0 R >>";
    objects[pagesId - 1] = "<< /Type /Pages /Kids [" + pageIds.map(function (id) { return id + " 0 R"; }).join(" ") + "] /Count " + pageIds.length + " >>";

    /* serialise */
    var pdf = "%PDF-1.4\n%âãÏÓ\n";
    var offsets = [0];
    for (var o = 0; o < objects.length; o++) {
      offsets.push(pdf.length);
      pdf += (o + 1) + " 0 obj\n" + objects[o] + "\nendobj\n";
    }
    var xrefPos = pdf.length;
    pdf += "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
    for (var x = 1; x <= objects.length; x++) {
      pdf += String(offsets[x]).padStart(10, "0") + " 00000 n \n";
    }
    pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root " + catalogId + " 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF";

    var bytes = new Uint8Array(pdf.length);
    for (var b = 0; b < pdf.length; b++) bytes[b] = pdf.charCodeAt(b) & 0xFF;
    return bytes;
  }

  /* ------------------------------------------------------------------ */
  /* PDF reader (browser only; loads pdf.js from cdnjs on first use)      */
  /* ------------------------------------------------------------------ */

  var PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  var PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  var pdfjsLoading = null;

  function loadPdfJs() {
    if (typeof window === "undefined") return Promise.reject(new Error("PDF reading works in the browser only"));
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfjsLoading) return pdfjsLoading;
    pdfjsLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = PDFJS_URL;
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        resolve(window.pdfjsLib);
      };
      s.onerror = function () {
        pdfjsLoading = null;
        reject(new Error("Could not load the PDF reader. Reading PDFs needs an internet connection once per session. You can also convert the file to .docx or .md and upload that."));
      };
      document.head.appendChild(s);
    });
    return pdfjsLoading;
  }

  function fromPdf(arrayBuffer) {
    return loadPdfJs().then(function (pdfjsLib) {
      return pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    }).then(function (pdf) {
      var pagePromises = [];
      for (var i = 1; i <= pdf.numPages; i++) {
        pagePromises.push(pdf.getPage(i).then(function (page) {
          return page.getTextContent();
        }));
      }
      return Promise.all(pagePromises);
    }).then(function (contents) {
      var paras = [];
      for (var c = 0; c < contents.length; c++) {
        var items = contents[c].items;
        var lastY = null, lastH = 12;
        var buf = "";
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          if (!it.str) continue;
          var y = it.transform[5];
          var h = it.height || lastH;
          if (lastY !== null && Math.abs(lastY - y) > h * 1.7) {
            /* big vertical gap: new paragraph */
            if (buf.trim()) paras.push(buf.trim());
            buf = "";
          } else if (lastY !== null && Math.abs(lastY - y) > 1) {
            /* new line inside same paragraph */
            if (buf && !/\s$/.test(buf)) buf += " ";
          }
          buf += it.str;
          if (it.hasEOL && !/\s$/.test(buf)) buf += " ";
          lastY = y; lastH = h;
        }
        if (buf.trim()) paras.push(buf.trim());
      }
      return paras.join("\n\n").replace(/[ \t]{2,}/g, " ");
    });
  }

  /* ------------------------------------------------------------------ */
  /* TXT                                                                  */
  /* ------------------------------------------------------------------ */

  function toTxt(text) {
    return parseDoc(text).map(function (p) {
      var t = p.runs.map(function (r) { return r.text; }).join("");
      return p.level ? t.toUpperCase() : t;
    }).join("\n\n");
  }

  return {
    toDocx: toDocx,
    fromDocx: fromDocx,
    toPdf: toPdf,
    fromPdf: fromPdf,
    toTxt: toTxt,
    plainText: plainText,
    zipStore: zipStore,
    unzip: unzip,
    parseDoc: parseDoc
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MyridiusFileIO;
}
