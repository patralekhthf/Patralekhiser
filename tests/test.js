/* Engine test harness. Run: node tests/test.js */
var fs = require("fs");
var path = require("path");
var engine = require("../src/engine.js");

var input = fs.readFileSync(path.join(__dirname, "..", "samples", "sample-article.md"), "utf8");
var result = engine.process(input, engine.defaultConfig);

var failures = [];
function check(name, cond) {
  if (!cond) failures.push(name);
  console.log((cond ? "PASS" : "FAIL") + "  " + name);
}

var out = result.output;

/* Auto fix assertions */
check("em dash removed", out.indexOf("—") === -1);
check("en dash removed outside numbers", !/[a-z]\s*–\s*[a-z]/i.test(out));
check("number range becomes 'to'", out.indexOf("10,000 to 50,000") !== -1);
check("emoji removed", !/[\u{1F680}\u{1F389}]/u.test(out));
check("'leverage' swapped", !/\bleverage\b/i.test(out));
check("'in order to' swapped", !/\bin order to\b/i.test(out));
check("'utilizing' swapped", !/\butilizing\b/i.test(out));
check("'seamless' swapped", !/\bseamless\b/i.test(out));
check("'empowers' swapped", !/\bempowers\b/i.test(out));
check("'facilitates' swapped", !/\bfacilitates\b/i.test(out));
check("'moreover' swapped", !/\bmoreover\b/i.test(out));
check("'furthermore' swapped", !/\bfurthermore\b/i.test(out));
check("'each and every' swapped", !/\beach and every\b/i.test(out));
check("'due to the fact that' swapped", !/due to the fact that/i.test(out));
check("'whether or not' swapped", !/whether or not/i.test(out));
check("'It is worth noting that' deleted", !/It is worth noting that/i.test(out));
check("'Needless to say' deleted", !/Needless to say/i.test(out));
check("'At the end of the day' deleted", !/at the end of the day/i.test(out));
check("contraction don't expanded", !/\bdon['’]t\b/.test(out));
check("contraction it's expanded", !/\bit['’]s\b/i.test(out));
check("stock opener deleted and recapitalized", /^Organizations must use modern solutions to stay ahead/m.test(out));

/* Protected terms untouched */
check("BusinessBook Plus intact", out.indexOf("BusinessBook Plus") !== -1);
check("Myridius intact (in URL and email)", out.indexOf("myridius.com") !== -1);
check("URL intact", out.indexOf("https://www.myridius.com") !== -1);
check("email intact", out.indexOf("hello@myridius.com") !== -1);

/* Flags */
function hasFlag(type, needle) {
  return result.flags.some(function (f) {
    return f.type === type && (!needle || (f.found + " " + f.excerpt).toLowerCase().indexOf(needle.toLowerCase()) !== -1);
  });
}
check("flags long sentence", hasFlag("Long sentence"));
check("flags passive voice", hasFlag("Passive voice"));
check("flags semicolon", hasFlag("Semicolon"));
check("flags hype word 'game-changing'", hasFlag("Word choice", "game-changing"));
check("flags 'ultimate'", hasFlag("Word choice", "ultimate"));
check("flags repetitive headings (Delving)", hasFlag("Repetitive headings"));
check("flags repetitive rhythm (The platform...)", hasFlag("Repetitive rhythm"));

/* Stats sanity */
check("readability improved or equal", result.stats.after.score >= result.stats.before.score);
check("changes recorded", result.changes.length > 30);

console.log("\n--- Stats ---");
console.log("Words: " + result.stats.before.words + " -> " + result.stats.after.words);
console.log("Flesch: " + result.stats.before.score + " -> " + result.stats.after.score);
console.log("Grade: " + result.stats.before.grade + " -> " + result.stats.after.grade);
console.log("Avg sentence: " + result.stats.before.avgSentence + " -> " + result.stats.after.avgSentence);
console.log("Changes: " + result.stats.changeCount + "  Flags: " + result.stats.flagCount);

if (process.argv.indexOf("--show") !== -1) {
  console.log("\n--- OUTPUT ---\n" + out);
  console.log("\n--- FLAGS ---");
  result.flags.forEach(function (f) {
    console.log("[" + f.type + "] " + f.found + " :: " + f.reason);
  });
}

if (failures.length) {
  console.log("\n" + failures.length + " FAILURE(S)");
  process.exit(1);
} else {
  console.log("\nAll checks passed.");
}
