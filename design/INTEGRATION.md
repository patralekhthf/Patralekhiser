# What changed against the original `index.html`

Grouped by the three script blocks and the markup. Nothing was deleted except the old
`renderFlags` list. All ids and function names the rest of the app depends on were kept.

## CSS (in `<style>`)

- Added the panel layer after `.empty`: `.res-score`, `.res-top`, `.res-num`,
  `.res-verdict`, `.res-sub`, `.res-dims`, `.res-dim`, `.res-bar`, `.res-filters`,
  `.res-chip` (+ `:hover`, `.on`), `.res-note`, `.res-doc`, `mark.rz` (+ `.sel`,
  `.done`, `.rev`), `.res-drawer` (capped at 48% with its own scroll), `.res-d-head`,
  `.res-quote`, `.res-why`, `.res-edit`, `.res-edit-label`, `.res-scope`,
  `.res-d-actions`, `.res-applied`, `.res-doclevel`.
- `.pane` gained `position: relative` so the drawer can dock inside the right pane.

## Markup

- Toolbar tab label: "Needs a human" -> "Resemblance" (`onclick="showTab('flags')"`,
  `id="tabFlags"`, badge `id="flagCount"` all unchanged).
- `#rightPane` gained `<div id="resDrawer" class="res-drawer hidden"></div>` as a sibling
  of `#rightBody`.
- Configuration view gained a full-width "Resemblance scoring" card with `#cfgDims`, above
  the existing `.cfg-grid`.
- The blocked-words help text now documents the five-field format.

## Script 1 — `MyridiusEngine`

Added to `DEFAULT_CONFIG`: `dimensions` (five entries, weight 1 each).
Two `flagWords` entries gained `dim` + `replace` as worked examples
(`in terms of`, `in conclusion`).

New functions, inserted before "Main entry point":
`DEFAULT_DIMENSIONS`, `protectedRanges`, `inRanges`, `guardText`, `sentenceSpans`,
`dimForFlagWord`, `SPECIFIC_PATTERNS`, `authorialPresence`, `collectParaFlags`,
`collectDocFlags`, `bandScore`, `scoreResemblance`, `reviewParas`.

Changed: `processDoc` now calls `reviewParas` instead of `analyze(joined)` and returns
`resemblance`. Exports gained `reviewParas`, `authorialPresence`, `defaultDimensions`.

Untouched: `transform`, `analyze`, `process`, every dictionary pass, `fleschScore`,
`protect`/`restore`, the file IO block (script 2) in its entirety.

## Script 3 — app UI

- `showTab` right-pane title for the third tab -> "Resemblance audit".
- `renderRight` third branch -> `renderResemblance(body)`.
- `run()` calls `resetReview()` and sets the badge to the score.
- `renderStats` appends `resemblance N/20 <verdict>`.
- `syncFrom` runs in the resemblance tab too, and measures paragraph offsets relative to
  the scroll container instead of subtracting the first paragraph's `offsetTop`.
- `renderFlags` was **replaced** by: `review` state, `resetReview`, `flagKey`,
  `dimIndex`, `dimColor`, `visibleFlag`, `reviewList`, `findFlag`,
  `renderResemblance`, `annotate`, `bindResemblanceEvents`, `selectFlag`,
  `revealSelection`, `stepFlag`, `hideDrawer`, `renderDrawer`, `sentenceRange`,
  `editRange`, `occurrenceIndex`, `replaceNth`, `acceptSelected`, `revertEdit`,
  `rebuild`.
- Config plumbing: `flagsToLines` / `linesToFlags` handle the two extra fields,
  `renderDimConfig` draws the weight inputs, `renderConfig` calls it, `applyConfig`
  reads the weights and rebuilds if a result is on screen.

## Re-applying onto a newer original

The patch is anchored on exact strings, so if the user's `index.html` has moved on: keep
the engine additions verbatim (they touch nothing existing), re-apply the four one-line
changes to `processDoc`, exports, `showTab` and `renderRight`, and re-check `syncFrom`.
Everything else is additive.
