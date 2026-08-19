#!/usr/bin/env bash
# Publishes Patralekhiser to the public repo, in the shape a non-technical person can use:
#
#   * a one-click link that just runs the app   (GitHub Pages serves index.html)
#   * a download for people who want their own copy   (release asset, versioned)
#   * a repo listing with two visible files, so nothing looks like source code
#
# Run this from your own Mac Terminal. It needs network access, which the Claude
# bridge VM does not have.
#
#   chmod +x publish.sh && ./publish.sh
#
# Requires: git, and gh (GitHub CLI) authenticated. Without gh, see MANUAL FALLBACK below.

set -euo pipefail

REPO="Patralekhiser-Public"
OWNER="patralekhthf"
TAG="v1.2.0-preview.4"
ASSET="Patralekhiser-${TAG}.html"
DEST="$HOME/Documents/Claude/Projects/$REPO"
SRC="$(cd "$(dirname "$0")" && pwd)"

echo "==> checking prerequisites"
command -v git >/dev/null || { echo "git not found"; exit 1; }
command -v gh  >/dev/null || { echo "gh not found. See MANUAL FALLBACK in this file."; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh is not logged in. Run: gh auth login"; exit 1; }
[ -f "$SRC/$ASSET" ] || { echo "missing $SRC/$ASSET. Build it first: python3 build-dist.py $TAG"; exit 1; }

echo "==> preparing $DEST"
mkdir -p "$DEST"
# index.html is what GitHub Pages serves, so the link needs no filename or version in it.
cp "$SRC/$ASSET" "$DEST/index.html"
cp "$SRC/README.md" "$DEST/README.md"
# Tells Pages to publish the file as-is instead of running it through Jekyll.
: > "$DEST/.nojekyll"
cd "$DEST"

if [ ! -d .git ]; then git init -q -b main; fi
# The versioned build lives on the release, not in the repo listing. Drop any
# stray copy an earlier run left behind, so visitors see two files, not four.
for stray in Patralekhiser-v*.html; do
  [ -e "$stray" ] && git rm -q --ignore-unmatch "$stray" 2>/dev/null && rm -f "$stray"
done
git add index.html README.md .nojekyll
git -c user.name="Satyam Patralekh" -c user.email="patralekh.satyam@myridius.com" \
    commit -q -m "Patralekhiser $TAG" || echo "   (nothing new to commit)"

echo "==> creating the public repo if it does not exist"
if ! gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  gh repo create "$OWNER/$REPO" --public \
    --description "Rewrites an article into plainer English and scores how much it still sounds AI-written. One web page, no install, nothing leaves your browser." \
    --source . --remote origin --push
else
  echo "   repo already exists, pushing"
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/$REPO.git"
  git push -u origin main
fi

echo "==> turning on GitHub Pages (serves index.html at a clean URL)"
if gh api "repos/$OWNER/$REPO/pages" >/dev/null 2>&1; then
  echo "   Pages already enabled"
else
  gh api -X POST "repos/$OWNER/$REPO/pages" \
    -f "source[branch]=main" -f "source[path]=/" >/dev/null \
    && echo "   enabled" \
    || echo "   could not enable Pages automatically. Do it once by hand: Settings > Pages > Deploy from a branch > main > / (root)"
fi

echo "==> tagging $TAG"
git tag -f "$TAG" -m "Patralekhiser $TAG"
git push -f origin "$TAG"

echo "==> publishing the release with the downloadable copy attached"
NOTES="Download the .html file at the bottom of this page, then double-click it. Nothing to install.

Or use it without downloading: https://$OWNER.github.io/$REPO/

What is new in this build: changed words are shaded green and hovering one shows what it said before, a small orange line marks deletions, and you can click any paragraph on the right to rewrite it yourself. Your edits are what Download produces.

Please read before relying on it: the score tells you how much the text resembles the way AI models write. It is not an AI detector and cannot tell you who wrote anything. Formal business writing scores high with no AI involved, and so does good English from a writer whose first language is not English. The score bands have not been calibrated yet, so expect them to be off. Full list of rough edges is in the README."

if gh release view "$TAG" --repo "$OWNER/$REPO" >/dev/null 2>&1; then
  gh release upload "$TAG" "$SRC/$ASSET" --repo "$OWNER/$REPO" --clobber
else
  gh release create "$TAG" "$SRC/$ASSET" \
    --repo "$OWNER/$REPO" \
    --title "Patralekhiser $TAG" \
    --notes "$NOTES" \
    --prerelease
fi

echo
echo "Send people this, it opens and runs:"
echo "  https://$OWNER.github.io/$REPO/"
echo
echo "Or this, to download a copy:"
echo "  https://github.com/$OWNER/$REPO/releases/latest"
echo
echo "Pages can take a minute or two to go live the very first time."

# ---------------------------------------------------------------------------
# MANUAL FALLBACK, if you do not want to install gh
#
# 1. Create the repo in a browser: https://github.com/new
#    Name: Patralekhiser-Public     Visibility: Public     Do NOT add a README.
#
# 2. In Terminal:
#      mkdir -p ~/Documents/Claude/Projects/Patralekhiser-Public
#      cd ~/Documents/Claude/Projects/Patralekhiser-Public
#      cp ~/Documents/Claude/Projects/Patralekhiser/publish/Patralekhiser-v1.2.0-preview.4.html index.html
#      cp ~/Documents/Claude/Projects/Patralekhiser/publish/README.md .
#      touch .nojekyll
#      git init -b main
#      git add index.html README.md .nojekyll
#      git commit -m "Patralekhiser v1.2.0-preview.4"
#      git remote add origin https://github.com/patralekhthf/Patralekhiser-Public.git
#      git push -u origin main
#
# 3. Turn on the one-click link:
#    Settings > Pages > Deploy from a branch > main > / (root) > Save
#    The app then lives at https://patralekhthf.github.io/Patralekhiser-Public/
#
# 4. Create the download in a browser:
#    https://github.com/patralekhthf/Patralekhiser-Public/releases/new
#      Tag: v1.2.0-preview.4   (choose "Create new tag on publish")
#      Title: Patralekhiser v1.2.0-preview.4
#      Drag Patralekhiser-v1.2.0-preview.4.html into the binaries box.
#      Tick "Set as a pre-release", then Publish release.
#
# Why a release asset and not a link to the file in the repo: GitHub serves a raw
# .html file as plain text, so clicking it shows the code instead of the app. A
# release asset downloads properly.
# ---------------------------------------------------------------------------
