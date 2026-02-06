#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

rm -rf dist

# Build library and CLI
bun build src/index.ts --outdir dist --format esm --sourcemap=external --target=node
bun build src/bin/demon-mcp-server.ts --outdir dist/bin --format esm --sourcemap=external --target=node
