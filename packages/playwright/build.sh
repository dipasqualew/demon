#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Build review-app first
echo "Building review-app..."
(cd ../review-app && npm run build)

rm -rf dist

# Build playwright library and binaries
bun build src/index.ts src/review-generator.ts --outdir dist --format esm --sourcemap=external --target=node
bun build src/bin/demon-demo-review.ts --outdir dist/bin --format esm --sourcemap=external --target=node
bun build src/bin/demon-demo-init.ts --outdir dist/bin --format esm --sourcemap=external --target=node

# Copy review template
echo "Copying review template..."
cp ../review-app/dist/index.html dist/review-template.html
