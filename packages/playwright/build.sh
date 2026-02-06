#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

rm -rf dist
bun build src/index.ts --outdir dist --format esm --sourcemap=external
bun build src/bin/demon-demo-review.ts --outdir dist/bin --format esm --sourcemap=external
bun build src/bin/demon-demo-init.ts --outdir dist/bin --format esm --sourcemap=external
