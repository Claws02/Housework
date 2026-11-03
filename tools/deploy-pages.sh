#!/usr/bin/env bash
# Build site/ and publish it to the gh-pages branch (GitHub Pages serves that branch).
#   tools/deploy-pages.sh
# One-time setup on GitHub: Settings → Pages → "Deploy from a branch" → gh-pages / (root).
set -euo pipefail
cd "$(dirname "$0")/.."
node tools/build-site.mjs
root=$(pwd)
src=$(git rev-parse --short HEAD)
tmp=$(mktemp -d)
git worktree add --detach "$tmp" >/dev/null
(
  cd "$tmp"
  git checkout --orphan gh-pages-tmp >/dev/null 2>&1
  git rm -rfq . >/dev/null 2>&1 || true
  cp -R "$root/site/." .
  git add -A
  git commit -qm "Publish site from $src"
  git push -fq origin HEAD:gh-pages
)
git worktree remove --force "$tmp"
git branch -D gh-pages-tmp >/dev/null 2>&1 || true
echo "Published to gh-pages ($src)."
