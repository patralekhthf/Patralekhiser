#!/usr/bin/env bash
# One-off tidy of Patralekhiser-Public after the earlier publish runs.
#
# Fixes three things:
#   1. Two versioned .html files are tracked in the repo alongside index.html, so
#      the file listing shows four items instead of two. index.html is the only
#      copy the repo needs; the versioned file belongs on the release, not here.
#   2. A v1.2.0-preview.1 release and tag still exist. That build has the
#      harness/leverage bug, and anyone browsing releases could download it.
#   3. The preview.3 release notes are the older text and do not mention the
#      one-click link.
#
# Run from your own Mac Terminal:  chmod +x cleanup-public.sh && ./cleanup-public.sh

set -euo pipefail

REPO="Patralekhiser-Public"
OWNER="patralekhthf"
KEEP_TAG="v1.2.0-preview.4"
DROP_TAG="v1.2.0-preview.1"
ASSET="Patralekhiser-${KEEP_TAG}.html"
DEST="$HOME/Documents/Claude/Projects/$REPO"
SRC="$(cd "$(dirname "$0")" && pwd)"

command -v gh >/dev/null || { echo "gh not found"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "run: gh auth login"; exit 1; }

echo "==> 1/4 removing the old build's release and tag"
if gh release view "$DROP_TAG" --repo "$OWNER/$REPO" >/dev/null 2>&1; then
  gh release delete "$DROP_TAG" --repo "$OWNER/$REPO" --yes --cleanup-tag
  echo "    deleted release and tag $DROP_TAG"
else
  echo "    $DROP_TAG already gone"
fi

echo "==> 2/4 removing stray copies of the app from the repo listing"
cd "$DEST"
git pull --quiet origin main || true
cp "$SRC/README.md" README.md
removed=0
for f in Patralekhiser-v*.html; do
  [ -e "$f" ] || continue
  git rm -q --ignore-unmatch "$f" && removed=1 && echo "    removed $f"
done
git add README.md
if ! git diff --cached --quiet; then
  git -c user.name="Satyam Patralekh" -c user.email="patralekh.satyam@myridius.com" \
      commit -q -m "Keep only index.html in the repo listing

The versioned build belongs on the release, where it downloads as a file.
Tracking it here as well showed visitors four items instead of two and made the
repo look like source code, which is what this repo exists to avoid.

Also points the README download link at the releases list rather than
releases/latest, which does not resolve while every release is a pre-release."
  git push origin main
  echo "    pushed"
else
  echo "    nothing to change"
fi

echo "==> 3/4 refreshing the release notes on $KEEP_TAG"
gh release edit "$KEEP_TAG" --repo "$OWNER/$REPO" --notes "Download the .html file at the bottom of this page, then double-click it. Nothing to install.

Or use it without downloading: https://$OWNER.github.io/$REPO/

What is new in this build: changed words are shaded green and hovering one shows what it said before, a small orange line marks deletions, and you can click any paragraph on the right to rewrite it yourself. Your edits are what Download produces. Also fixes a bug where words like \"harness\" and \"leverage\" were rewritten to \"use\" even when used as nouns, so \"an eval harness\" became \"an eval use\".

Please read before relying on it: the score tells you how much the text resembles the way AI models write. It is not an AI detector and cannot tell you who wrote anything. Formal business writing scores high with no AI involved, and so does good English from a writer whose first language is not English. The score bands have not been calibrated yet, so expect them to be off. Full list of rough edges is in the README." >/dev/null
echo "    updated"

echo "==> 4/4 confirming the asset is attached"
gh release view "$KEEP_TAG" --repo "$OWNER/$REPO" --json assets \
  --jq '.assets[].name' | sed 's/^/    /'

echo
echo "Done. Public repo now shows: README.md, index.html (plus hidden .nojekyll)."
echo "  use it:      https://$OWNER.github.io/$REPO/"
echo "  download it: https://github.com/$OWNER/$REPO/releases"
