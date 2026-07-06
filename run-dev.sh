#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODEX_RUNTIME="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
NODE_BIN="$CODEX_RUNTIME/node/bin"
PNPM="$CODEX_RUNTIME/bin/pnpm"

if [[ ! -x "$PNPM" ]]; then
  echo "Could not find Codex's bundled pnpm at:"
  echo "  $PNPM"
  echo
  echo "Install Node.js from https://nodejs.org/ instead, then run:"
  echo "  npm install"
  echo "  npm run dev"
  exit 1
fi

export PATH="$NODE_BIN:$CODEX_RUNTIME/bin:$PATH"
export CI=true

cd "$ROOT_DIR"
"$PNPM" install --no-frozen-lockfile
"$PNPM" run dev
