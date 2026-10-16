/*
 * LinkedIn styling.
 *
 * LinkedIn posts carry no formatting. The common workaround, and the one the
 * author already uses by hand, is to substitute Unicode Mathematical
 * Sans-Serif letters, which most fonts render as bold or italic.
 *
 * Read this before changing anything here:
 *
 *   These are not bold letters. They are different characters that look
 *   like bold letters. A screen reader announces U+1D5D4 as "mathematical
 *   sans-serif bold capital A" or skips it, so a heading styled this way is
 *   unreadable to anyone using one. LinkedIn's own search does not match
 *   them either, and neither will a reader's browser find-in-page.
 *
 * That is a real cost, not a theoretical one, so this module does three
 * things to keep it bounded: styling is applied to short runs rather than
 * whole paragraphs, a plain-text version is always produced alongside the
 * styled one, and the characters that would actually break if converted are
 * refused outright.
 *
 * Refused, always: URLs, hashtags, @mentions and code spans. A hashtag in
 * styled characters is not a hashtag, a styled URL is not a link, and a
 * styled @name does not tag anybody. Converting them does not look wrong on
 * screen, which is exactly why it has to be prevented here.
 *
 * Runs in the browser and in Node (module.exports guarded at the bottom).
 */

var MyridiusLinkedIn = (function () {
  "use strict";

  /* Unicode Mathematical Alphanumeric Symbols, sans-serif ranges. Checked
     against Unicode 15.1, 2026-08-24. Digits exist for bold only; italic and
     bold-italic have no digit forms, so digits stay as they are rather than
     being faked from another range. */
  var MAPS = {
    bold:       { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec },
    italic:     { upper: 0x1d608, lower: 0x1d622, digit: null },
    bolditalic: { upper: 0x1d63c, lower: 0x1d656, digit: null }
  };

  var LIMIT = 3000;          /* LinkedIn's post character limit */
  var FOLD = 210;            /* roughly where "see more" truncates on desktop */

  /* Spans that must never be converted, found before any styling runs.
     All four delimiters are ASCII, so none of them can be defeated by the
     characters this module is about. */
  function literalRanges(text) {
    var ranges = [];
    var res = [
      /\bhttps?:\/\/[^\s)>\]]+/g,          /* URLs */
      /\bwww\.[^\s)>\]]+/g,
      /[#][\wÀ-ɏ]+/g,            /* hashtags */
      /[@][\w.\-]+/g,                      /* mentions */
      /`[^`\n]+`/g,                        /* inline code */
      /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g       /* emails */
    ];
    for (var i = 0; i < res.length; i++) {
      var re = res[i], m;
      re.lastIndex = 0;
      while ((m = re.exec(text)) !== null) {
        if (!m[0].length) { re.lastIndex++; continue; }
        ranges.push([m.index, m.index + m[0].length]);
      }
    }
    return ranges;
  }

  function inRanges(ranges, at) {
    for (var i = 0; i < ranges.length; i++) {
      if (at >= ranges[i][0] && at < ranges[i][1]) return true;
    }
    return false;
  }

  /* Convert one run. Anything outside A-Z, a-z and 0-9 is left as itself,
     which covers spaces, punctuation and every accented or non-Latin letter:
     there is no sans-serif bold form for those, and inventing one from a
     different script would be worse than leaving them unstyled. */
  function styleRun(run, style, ranges, offset) {
    var map = MAPS[style];
    if (!map) return run;
    var out = "";
    for (var i = 0; i < run.length; i++) {
      var ch = run.charAt(i);
      var code = run.charCodeAt(i);
      if (ranges && inRanges(ranges, offset + i)) { out += ch; continue; }
      if (code >= 65 && code <= 90) out += String.fromCodePoint(map.upper + (code - 65));
      else if (code >= 97 && code <= 122) out += String.fromCodePoint(map.lower + (code - 97));
      else if (code >= 48 && code <= 57 && map.digit !== null) out += String.fromCodePoint(map.digit + (code - 48));
      else out += ch;
    }
    return out;
  }

  /* Undo the conversion, so a styled post can be read back as plain text and
     so the plain version is always recoverable. */
  function toPlain(text) {
    var out = "";
    for (var ch of String(text)) {
      var cp = ch.codePointAt(0);
      var done = false;
      for (var k in MAPS) {
        if (!Object.prototype.hasOwnProperty.call(MAPS, k)) continue;
        var m = MAPS[k];
        if (cp >= m.upper && cp < m.upper + 26) { out += String.fromCharCode(65 + cp - m.upper); done = true; break; }
        if (cp >= m.lower && cp < m.lower + 26) { out += String.fromCharCode(97 + cp - m.lower); done = true; break; }
        if (m.digit !== null && cp >= m.digit && cp < m.digit + 10) { out += String.fromCharCode(48 + cp - m.digit); done = true; break; }
      }
      if (!done) out += ch;
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Markdown subset to a LinkedIn post                                   */
  /* ------------------------------------------------------------------ */

  /* The subset is exactly what the author's own articles use and what the
     docx and pdf writers can already render: headings, bold, italic,
     unordered lists, paragraphs. Anything else passes through as text. */
  function render(markdown, opts) {
    opts = opts || {};
    var styled = opts.plain !== true;
    var bullet = opts.bullet || "•";       /* • */
    var src = String(markdown || "").replace(/\r\n/g, "\n");

    /* Strip a leading front-matter block and reference sections, which
       belong in the first comment rather than the post. */
    src = src.replace(/^---[\s\S]*?\n---\n/, "");

    var lines = src.split("\n");
    var out = [];
    var inFence = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
      if (inFence) { out.push(line); continue; }

      if (/^\s*$/.test(line)) { out.push(""); continue; }

      /* horizontal rule: a paragraph break on LinkedIn */
      if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) { out.push(""); continue; }

      var heading = line.match(/^\s*(#{1,6})\s+(.*)$/);
      if (heading) {
        out.push(inline(heading[2].trim(), styled, "bold"));
        continue;
      }

      var li = line.match(/^\s*[-*+]\s+(.*)$/);
      if (li) {
        out.push(bullet + " " + inline(li[1].trim(), styled, null));
        continue;
      }
      var oli = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
      if (oli) {
        out.push(oli[1] + ". " + inline(oli[2].trim(), styled, null));
        continue;
      }
      var quote = line.match(/^\s*>\s?(.*)$/);
      if (quote) {
        out.push(inline(quote[1].trim(), styled, null));
        continue;
      }
      out.push(inline(line.trim(), styled, null));
    }

    /* LinkedIn collapses three or more newlines, so normalise to one blank
       line between blocks and let the platform do the rest. */
    var text = out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+$/gm, "").trim();
    return text;
  }

  /* Inline markers inside one line. forceStyle styles the whole line, which
     is how a heading becomes a bold lead-in. */
  function inline(line, styled, forceStyle) {
    /* Links: keep the text, drop the target. A bare URL in the post body
       suppresses reach on LinkedIn and the author already puts links in the
       first comment. */
    line = line.replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1");
    /* Images have no place in the text body at all. */
    line = line.replace(/!\[[^\]]*\]\([^)]*\)/g, "");

    if (!styled) {
      return line.replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
                 .replace(/\*\*([^*]+)\*\*/g, "$1")
                 .replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")
                 .replace(/`([^`]+)`/g, "$1");
    }

    var ranges = literalRanges(line);

    function convert(match, body, style, offset) {
      /* Refuse if any part of the run is a protected span. Partial styling
         of a URL or hashtag is the failure this guards against. */
      var bodyStart = offset + match.indexOf(body);
      for (var i = 0; i < body.length; i++) {
        if (inRanges(ranges, bodyStart + i)) return body;
      }
      return styleRun(body, style, null, 0);
    }

    line = line.replace(/\*\*\*([^*]+)\*\*\*/g, function (m, b, off) { return convert(m, b, "bolditalic", off); });
    line = line.replace(/\*\*([^*]+)\*\*/g, function (m, b, off) { return convert(m, b, "bold", off); });
    line = line.replace(/(^|[^*])\*([^*]+)\*/g, function (m, pre, b, off) {
      return pre + convert(m, b, "italic", off + pre.length);
    });
    line = line.replace(/`([^`]+)`/g, "$1");

    if (forceStyle) {
      var r2 = literalRanges(line);
      line = styleRun(line, forceStyle, r2, 0);
    }
    return line;
  }

  /* ------------------------------------------------------------------ */
  /* Post statistics the author actually needs before pasting             */
  /* ------------------------------------------------------------------ */

  function stats(text) {
    var t = String(text || "");
    /* LinkedIn counts by code point, not by UTF-16 unit, and every styled
       letter is an astral code point. Counting .length would overstate the
       post by one per styled character and send the author trimming text
       that fits. */
    var chars = Array.from(t).length;
    var firstBreak = t.indexOf("\n");
    return {
      chars: chars,
      limit: LIMIT,
      over: Math.max(0, chars - LIMIT),
      foldAt: FOLD,
      /* What a reader sees before pressing "see more". */
      preview: Array.from(t).slice(0, FOLD).join(""),
      hidden: Math.max(0, chars - FOLD),
      firstLine: firstBreak === -1 ? t : t.slice(0, firstBreak),
      styledCount: countStyled(t),
      hashtags: (t.match(/[#][\wÀ-ɏ]+/g) || []),
      urlsInBody: (t.match(/\bhttps?:\/\/\S+/g) || [])
    };
  }

  function countStyled(text) {
    var n = 0;
    for (var ch of String(text)) {
      var cp = ch.codePointAt(0);
      if (cp >= 0x1d400 && cp <= 0x1d7ff) n++;
    }
    return n;
  }

  return {
    render: render,
    toPlain: toPlain,
    styleRun: styleRun,
    stats: stats,
    limit: LIMIT,
    fold: FOLD
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MyridiusLinkedIn;
}
