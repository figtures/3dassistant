#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${PRINTFLOW_BRIDGE_VERSION:-0.1.0}"
OUT="$ROOT/dist"
mkdir -p "$OUT"

build() {
  local goos=$1 goarch=$2 ext=""
  [[ "$goos" == "windows" ]] && ext=".exe"
  local name="printflow-bridge_${VERSION}_${goos}_${goarch}${ext}"
  echo "→ $name"
  GOOS=$goos GOARCH=$goarch CGO_ENABLED=0 go build -trimpath \
    -ldflags "-s -w -X main.agentVersion=printflow-bridge/${VERSION}" \
    -o "$OUT/printflow-bridge_${VERSION}_${goos}_${goarch}${ext}" "$ROOT"
}

cd "$ROOT"
go mod tidy

build darwin arm64
build darwin amd64
build linux amd64
build windows amd64

echo "=== Paketler (1) ==="
if command -v pkgbuild >/dev/null; then
  ./installers/macos/package.sh arm64
  ./installers/macos/package.sh amd64
else
  echo "pkgbuild yok — macOS .pkg atlandı"
fi

if command -v dpkg-deb >/dev/null; then
  ./installers/linux/package-deb.sh
else
  echo "dpkg-deb yok — .deb atlandı"
fi

if command -v makensis >/dev/null; then
  PRINTFLOW_BRIDGE_VERSION="$VERSION" makensis \
    -DPRINTFLOW_BRIDGE_VERSION="$VERSION" \
    "$ROOT/installers/windows/printflow-bridge.nsi" || true
else
  echo "makensis yok — Windows setup atlandı"
fi

echo "Artefaktlar: $OUT"
