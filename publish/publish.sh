#!/usr/bin/env bash
# Creates the public repo, pushes the HTML and README, tags it and publishes a release
# with the HTML attached as a downloadable asset.
#
# Run this from your own Mac Terminal. It needs network access, which the Claude
# bridge VM does not have.
#
#   chmod +x publish.sh && ./publish.sh
#
# Requires: git, and gh (GitHub CLI) authenticated. If you do not have gh, see the
# MANUAL FALLBACK notes at the bottom of this file.

set -euo pipefail

REPO="Patralekhiser-Public"
OWNER="patralekhthf"
TAG="v1.2.0-preview.1"
ASSET="Patralekhiser-v1.2.0-preview.1.html"
DEST="$HOME/Documents/Claude/Projects/$REPO"
SRC="$(cd "$(dirname "$0")" && pwd)"

echo "==> checking prerequisites"
command -v git >/dev/null || { echo "git not found"; exit 1; }
command -v gh  >/dev/null || { echo "gh not found. See MANUAL FALLBACK in this file."; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh is not logged in. Run: gh auth login"; exit 1; }

echo "==> preparing $DEST"
mkdir -p "$DEST"
cp "$SRC/$ASSET" "$DEST/"
cp "$SRC/README.md" "$DEST/"
cd "$DEST"

if [ ! -d .git ]; then
  git init -q -b main
fi
git add "$ASSET" README.md
git -c user.name="Satyam Patralekh" -c user.email="patralekh.satyam@myridius.com" \
    commit -q -m "Patralekhiser $TAG: public test build" || echo "   (nothing new to commit)"

echo "==> creating the public repo if it does not exist"
if ! gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then
  gh repo create "$OWNER/$REPO" --public \
    --description "Browser-based article rewriter with a resemblance audit. No AI, no server, single HTML file." \
    --source . --remote origin --push
else
  echo "   repo already exists, pushing"
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/$REPO.git"
  git push -u origin main
fi

echo "==> tagging $TAG"
git tag -f "$TAG" -m "Patralekhiser $TAG"
git push -f origin "$TAG"

echo "==> publishing the release with the HTML attached"
if gh release view "$TAG" --repo "$OWNER/$REPO" >/dev/null 2>&1; then
  gh release upload "$TAG" "$ASSET" --repo "$OWNER/$REPO" --clobber
else
  gh release create "$TAG" "$ASSET" \
    --repo "$OWNER/$REPO" \
    --title "Patralekhiser $TAG" \
    --notes "First public test build, including the resemblance audit.

Download the .html file below and double-click it. No install, nothing leaves your browser.

The Resemblance score measures resemblance to the default register of model prose. It cannot
establish authorship. Thresholds are uncalibrated and second-language English is likely
scored unfairly high. See the README and the note at the top of the app for the full list of
known limits." \
    --prerelease
fi

echo
echo "Done. Share this link:"
echo "  https://github.com/$OWNER/$REPO/releases/latest"
echo
echo "Direct download link for the asset:"
echo "  https://github.com/$OWNER/$REPO/releases/download/$TAG/$ASSET"

# ---------------------------------------------------------------------------
# MANUAL FALLBACK, if you do not want to install gh
#
# 1. Create the repo in a browser: https://github.com/new
#    Name: Patralekhiser-Public     Visibility: Public     Do NOT add a README.
#
# 2. In Terminal:
#      mkdir -p ~/Documents/Claude/Projects/Patralekhiser-Public
#      cd ~/Documents/Claude/Projects/Patralekhiser-Public
#      cp <this folder>/Patralekhiser-v1.2.0-preview.1.html .
#      cp <this folder>/README.md .
#      git init -b main
#      git add .
#      git commit -m "Patralekhiser v1.2.0-preview.1: public test build"
#      git remote add origin https://github.com/patralekhthf/Patralekhiser-Public.git
#      git push -u origin main
#
# 3. Create the release in a browser:
#    https://github.com/patralekhthf/Patralekhiser-Public/releases/new
#      Tag: v1.2.0-preview.1   (choose "Create new tag on publish")
#      Title: Patralekhiser v1.2.0-preview.1
#      Attach the .html file by dragging it into the binaries box.
#      Tick "Set as a pre-release", then Publish release.
#
# The attached asset downloads as a file. A raw file link would open as text instead,
# which is the whole reason for using a release.
# ---------------------------------------------------------------------------
