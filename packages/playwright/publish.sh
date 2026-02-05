#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

BUMP="${1:-patch}"

if [[ "$BUMP" != "major" && "$BUMP" != "minor" && "$BUMP" != "patch" ]]; then
  echo "Usage: ./publish.sh [major|minor|patch]"
  echo "Defaults to patch"
  exit 1
fi

npm version "$BUMP" --no-git-tag-version
VERSION=$(node -p "require('./package.json').version")

git add package.json
git commit -m "chore: bump @demon-utils/playwright to v${VERSION}"

git push

./build.sh

npm publish --access public
