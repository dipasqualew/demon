#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

BUMP="${1:-patch}"

if [[ "$BUMP" != "major" && "$BUMP" != "minor" && "$BUMP" != "patch" ]]; then
  echo "Usage: ./publish.sh [major|minor|patch]"
  echo "Defaults to patch"
  exit 1
fi

# Get current versions
PACKAGE_NAME=$(node -p "require('./package.json').name")
LOCAL_VERSION=$(node -p "require('./package.json').version")
NPM_VERSION=$(npm view "$PACKAGE_NAME" version 2>/dev/null || echo "0.0.0")

# Compare versions (returns 1 if first > second)
version_gt() {
  local IFS=.
  local i v1=($1) v2=($2)
  for ((i=0; i<3; i++)); do
    if ((${v1[i]:-0} > ${v2[i]:-0})); then return 0; fi
    if ((${v1[i]:-0} < ${v2[i]:-0})); then return 1; fi
  done
  return 1
}

if version_gt "$LOCAL_VERSION" "$NPM_VERSION"; then
  echo "Local version ($LOCAL_VERSION) is already higher than NPM ($NPM_VERSION)"
  echo "Skipping version bump (previous publish may have failed)"
  VERSION="$LOCAL_VERSION"
  BUMPED=false
else
  npm version "$BUMP" --no-git-tag-version
  VERSION=$(node -p "require('./package.json').version")
  BUMPED=true
fi

if $BUMPED; then
  git add package.json
  git commit -m "chore: bump @demon-utils/playwright to v${VERSION}"
  git push
fi

./build.sh

npm publish --access public
