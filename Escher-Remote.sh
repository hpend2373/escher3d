#!/usr/bin/env bash

set -euo pipefail

package_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
remote_port="${1:-40456}"

if ! [[ "$remote_port" =~ ^[0-9]+$ ]] || (( remote_port < 1 || remote_port > 65535 )); then
  printf '%s\n' "사용법: $0 [포트번호]"
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' "Node.js 18 이상이 필요합니다."
  exit 1
fi

if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 18 ? 0 : 1)"; then
  printf '%s\n' "Node.js 18 이상이 필요합니다."
  exit 1
fi

exec node "$package_dir/server.mjs" \
  --app-root "$package_dir/app" \
  --host 0.0.0.0 \
  --port "$remote_port" \
  --access-token auto \
  --open-path "/?map=merged" \
  --open
