#!/usr/bin/env bash

set -euo pipefail

PACKAGE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MAP_NAME="${1:-merged}"

case "$MAP_NAME" in
  map00240|map00410|merged) ;;
  *)
    printf '%s\n' "사용법: $0 [map00240|map00410|merged]"
    exit 2
    ;;
esac

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' "Node.js 18 이상이 필요합니다."
  printf '%s\n' "https://nodejs.org 에서 설치한 뒤 다시 실행해 주세요."
  exit 1
fi

if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"; then
  printf '%s\n' "현재 Node.js 버전이 너무 낮습니다. Node.js 18 이상이 필요합니다."
  exit 1
fi

exec node "$PACKAGE_DIR/server.mjs" \
  --app-root "$PACKAGE_DIR/app" \
  --port 0 \
  --open-path "/?map=$MAP_NAME" \
  --open
