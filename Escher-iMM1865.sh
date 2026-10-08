#!/usr/bin/env bash

set -euo pipefail

package_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
map_name="${1:-merged}"

case "$map_name" in
  map00240|map00410|merged) ;;
  *)
    echo "사용법: $0 [merged|map00240|map00410]"
    exit 2
    ;;
esac

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18 이상이 필요합니다."
  exit 1
fi

node_major="$(node -p "process.versions.node.split('.')[0]")"
if (( node_major < 18 )); then
  echo "Node.js 18 이상이 필요합니다. 현재 버전: $(node --version)"
  exit 1
fi

exec node "$package_dir/server.mjs" \
  --app-root "$package_dir/app" \
  --port 0 \
  --open-path "/?map=$map_name" \
  --open
