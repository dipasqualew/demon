#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: dev-install.sh <target-repo-path>"
  echo ""
  echo "Installs local @demon-utils/playwright package into a target repository for testing."
  echo ""
  echo "This script will:"
  echo "  1. Reinstall the Claude demon@demon-marketplace plugin"
  echo "  2. Build packages/playwright"
  echo "  3. Register the local package with bun link"
  echo "  4. Link the package in the target repo's e2e directory"
  echo ""
  echo "Example:"
  echo "  ./dev-install.sh /path/to/my-project"
  exit 1
}

[[ $# -ne 1 ]] && usage

TARGET_PATH="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLAYWRIGHT_DIR="${SCRIPT_DIR}/packages/playwright"

# Validate target path exists
if [[ ! -d "$TARGET_PATH" ]]; then
  echo "Error: Target path does not exist: $TARGET_PATH"
  exit 1
fi

# Validate target has e2e/package.json
if [[ ! -f "${TARGET_PATH}/e2e/package.json" ]]; then
  echo "Error: Target path does not contain e2e/package.json: ${TARGET_PATH}/e2e/package.json"
  exit 1
fi

echo "Target repo: $TARGET_PATH"
echo ""

# Step 1: Reinstall Claude plugin
echo "Reinstalling Claude plugin..."
claude plugin remove demon@demon-marketplace || true
claude plugin install demon@demon-marketplace
echo ""

# Step 2: Build packages/playwright
echo "Building packages/playwright..."
(cd "$PLAYWRIGHT_DIR" && ./build.sh)
echo ""

# Step 3: Register local package with bun link
echo "Registering local package with bun link..."
(cd "$PLAYWRIGHT_DIR" && bun link)
echo ""

# Step 4: Link package in target repo
echo "Linking @demon-utils/playwright in target repo..."
(cd "${TARGET_PATH}/.demoon" && bun link @demon-utils/playwright)
echo ""

echo "Done! @demon-utils/playwright is now linked from local source."
