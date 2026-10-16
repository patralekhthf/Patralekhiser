/*
 * User rules: the override layer.
 *
 * Everything else in this project is a rule someone else wrote. This file is
 * the one place the author overrules all of it. A rule here wins over the
 * voice profile, over the house style, and over every built-in dictionary,
 * and it is applied LAST so that it also catches words the built-in rules
 * themselves introduced.
 *
 * The format is deliberately not JSON. A rules file is edited in a hurry, in
 * a text box, by a person who is mid-sentence and annoyed at a word. Braces
 * and quotes are a tax on that. One rule per line, hash for a comment.
 *
 *   never: Excellent -> Good        ban it, use this instead
 *   never: delve                    ban it, no substitute: flag for a human
 *   always: over two decades        never rewrite this, whatever the rules say
 *   protect: Patralekh              never touch, like a brand name
 *
 * Runs in the browser and in Node (module.exports guarded at the bottom).
 */

var MyridiusRules = (function () {
  "use strict";

  var VERBS = { never: 1, always: 1, protect: 1 };

  /* ------------------------------------------------------------------ */
  /* Parsing                                                             */
  /* ------------------------------------------------------------------ */

  /* Returns { never, always, protect, errors }. Never throws: a rules file
     is hand-edited, so a bad line is reported next to the line and the rest
     of the file still applies. Refusing the whole file over one typo would
     silently drop every other rule the author wrote. */
  function parse(text) {
    var out = { never: [], always: [], protect: [], errors: [] };
    var lines = String(text || "").split(/\r?\n/);
    var seen = {};

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var line = raw.replace(/\s+$/, "");
      var n = i + 1;

      /* comments and blanks */
      var stripped = line.replace(/^\s+/, "");
      if (!stripped || stripped.charAt(0) === "#") continue;

      var colon = stripped.indexOf(":");
      if (colon === -1) {
        out.errors.push({ line: n, text: line, message: 'No verb. Write "never:", "always:" or "protect:" before the word.' });
        continue;
      }
      var verb = stripped.slice(0, colon).trim().toLowerCase();
      var body = stripped.slice(colon + 1).trim();

      if (VERBS[verb] !== 1) {
        out.errors.push({ line: n, text: line, message: 'Unknown rule "' + verb + '". Use never, always or protect.' });
        continue;
      }
      if (!body) {
        out.errors.push({ line: n, text: line, message: "Nothing after the colon." });
        continue;
      }

      if (verb === "never") {
        /* "never: X -> Y" or "never: X" */
        var arrow = body.indexOf("->");
        var find = arrow === -1 ? body : body.slice(0, arrow).trim();
        var replace = arrow === -1 ? null : body.slice(arrow + 2).trim();
        if (!find) {
          out.errors.push({ line: n, text: line, message: "Nothing to ban before the arrow." });
          continue;
        }
        if (arrow !== -1 && replace === "") {
          /* "never: X ->" is almost certainly a half-typed rule, not a
             request to delete the word. Deleting would change meaning. */
          out.errors.push({ line: n, text: line, message: 'Arrow with no replacement. Write "never: ' + find + '" to flag it, or give a word after ->.' });
          continue;
        }
        var key = "never|" + find.toLowerCase();
        if (seen[key]) {
          out.errors.push({ line: n, text: line, message: '"' + find + '" is already banned on line ' + seen[key] + ". The later rule wins." });
        }
        seen[key] = n;
        out.never.push({ find: find, replace: replace, line: n });
      } else {
        var key2 = verb + "|" + body.toLowerCase();
        if (seen[key2]) {
          out.errors.push({ line: n, text: line, message: '"' + body + '" is already listed on line ' + seen[key2] + "." });
        }
        seen[key2] = n;
        out[verb].push({ find: body, line: n });
      }
    }
    return out;
  }

  /* Write the rules back out, so the UI can round-trip an edited file. */
  function serialize(rules) {
    var out = ["# My rules. This file wins over everything the tool decides.", ""];
    if (rules.protect.length) {
      out.push("# Never touched by any rule.");
      rules.protect.forEach(function (r) { out.push("protect: " + r.find); });
      out.push("");
    }
    if (rules.never.length) {
      out.push("# Banned. With an arrow it is swapped, without one it is flagged.");
      rules.never.forEach(function (r) {
        out.push("never: " + r.find + (r.replace === null ? "" : " -> " + r.replace));
      });
      out.push("");
    }
    if (rules.always.length) {
      out.push("# Left alone even if a built-in rule would change it.");
      rules.always.forEach(function (r) { out.push("always: " + r.find); });
      out.push("");
    }
    return out.join("\n");
  }

  /* ------------------------------------------------------------------ */
  /* Conflicts with the built-in rules                                   */
  /* ------------------------------------------------------------------ */

  /* A banned word that a built-in rule produces is the one conflict worth
     reporting at load time rather than at run time: the author bans
     "Excellent", a hype swap rewrites something INTO "excellent", and the
     banned word appears in output that the author believes is clean. The
     override still catches it, because it runs last, but the author should
     know the two rules disagree. */
  function conflicts(rules, config) {
    var out = [];
    if (!config) return out;
    var banned = {};
    rules.never.forEach(function (r) { banned[r.find.toLowerCase()] = r; });
    var always = {};
    rules.always.forEach(function (r) { always[r.find.toLowerCase()] = r; });

    ["simpleSwaps", "hypeSwaps", "fillerPhrases", "contractions"].forEach(function (list) {
      (config[list] || []).forEach(function (rule) {
        var to = String(rule.replace || "").toLowerCase();
        var from = String(rule.find || "").toLowerCase();
        if (to && banned[to]) {
          out.push({
            kind: "produces-banned",
            message: 'The built-in rule "' + rule.find + " -> " + rule.replace +
                     '" produces "' + rule.replace + '", which you banned on line ' + banned[to].line +
                     ". Your rule runs last and still wins."
          });
        }
        if (from && always[from]) {
          out.push({
            kind: "always-vs-builtin",
            message: 'You keep "' + rule.find + '" (line ' + always[from].line +
                     '), but a built-in rule would change it to "' + rule.replace + '". Yours wins.'
          });
        }
      });
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Applying                                                            */
  /* ------------------------------------------------------------------ */

  function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /* Match the casing of what was there, so a banned word at the start of a
     sentence does not come back lowercase. */
  function matchCase(source, replacement) {
    if (source.toUpperCase() === source && source.length > 2) return replacement.toUpperCase();
    /* A digit or symbol has no case, so "20 years" must not be read as
       capitalised and come back as "Over two decades" mid-sentence. Only a
       letter can tell us the source was capitalised. */
    var first = source.charAt(0);
    if (/[a-z]/i.test(first) && first === first.toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  }

  /* A word boundary that also refuses a match inside a longer word, so
     banning "ex" does not maul "excellent". Multi-word phrases are matched
     whole. Apostrophes are matched in both the straight and curly form,
     because a pasted document carries whichever its source used. */
  function ruleRegex(find) {
    var body = escapeRegex(find).replace(/'/g, "['’]").replace(/\s+/g, "\\s+");
    var lead = /^[\w]/.test(find) ? "\\b" : "";
    var tail = /[\w]$/.test(find) ? "\\b" : "";
    return new RegExp(lead + body + tail, "gi");
  }

  /* Apply the override layer. Runs AFTER every built-in pass, so it also
     catches words those passes introduced.

     A ban with a replacement is applied. A ban without one is flagged and
     the text is left alone: the tool does not know what the author meant,
     and guessing a substitute for a word someone deliberately banned is
     exactly the kind of silent meaning-change this project refuses to make
     everywhere else. */
  function apply(text, rules, changes, flags) {
    if (!rules || !rules.never.length) return text;
    changes = changes || [];
    flags = flags || [];

    /* Spans the author marked "always": positions that no ban may touch. */
    var keep = [];
    (rules.always || []).forEach(function (r) {
      var re = ruleRegex(r.find);
      var m;
      while ((m = re.exec(text)) !== null) {
        keep.push([m.index, m.index + m[0].length]);
        if (!m[0].length) re.lastIndex++;
      }
    });
    function kept(start, end) {
      for (var i = 0; i < keep.length; i++) {
        if (start < keep[i][1] && end > keep[i][0]) return true;
      }
      return false;
    }

    rules.never.forEach(function (rule) {
      var re = ruleRegex(rule.find);
      if (rule.replace === null) {
        /* Flag only. The author banned it but did not say what to use. */
        var m;
        var seenAt = {};
        while ((m = re.exec(text)) !== null) {
          if (!m[0].length) { re.lastIndex++; continue; }
          if (kept(m.index, m.index + m[0].length)) continue;
          if (seenAt[m.index]) continue;
          seenAt[m.index] = 1;
          flags.push({
            type: "Your rule",
            kind: "advice",
            found: m[0],
            start: m.index,
            end: m.index + m[0].length,
            reason: 'You banned "' + rule.find + '" on line ' + rule.line + " of your rules",
            suggestion: "Rewrite this yourself, or add a replacement to the rule: never: " +
                        rule.find + " -> your word",
            excerpt: snippet(text, m.index, m[0].length)
          });
        }
        return;
      }
      var count = 0;
      var before = null;
      text = text.replace(re, function (match, offset) {
        if (kept(offset, offset + match.length)) return match;
        count++;
        if (before === null) before = match;
        return matchCase(match, rule.replace);
      });
      if (count > 0) {
        changes.push({
          category: "Your rule",
          before: before,
          after: rule.replace,
          context: "line " + rule.line + " of your rules" + (count > 1 ? ", " + count + " times" : "")
        });
      }
    });
    return text;
  }

  function snippet(text, index, len) {
    var start = Math.max(0, index - 32);
    var end = Math.min(text.length, index + len + 32);
    return (start > 0 ? "..." : "") + text.slice(start, end).replace(/\n/g, " ") + (end < text.length ? "..." : "");
  }

  /* Terms the author marked protect:, in the shape protect() already takes. */
  function protectedTerms(rules) {
    return (rules && rules.protect ? rules.protect : []).map(function (r) { return r.find; });
  }

  return {
    parse: parse,
    serialize: serialize,
    apply: apply,
    conflicts: conflicts,
    protectedTerms: protectedTerms
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MyridiusRules;
}
