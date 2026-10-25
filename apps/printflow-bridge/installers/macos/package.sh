#!/usr/bin/env bash
# macOS .pkg — codesign + notarize üretimde SIGN_IDENTITY ve notarytool ile tamamlanır.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="${PRINTFLOW_BRIDGE_VERSION:-0.1.0}"
ARCH="${1:-arm64}"
BIN="$ROOT/dist/printflow-bridge_${VERSION}_darwin_${ARCH}"
STAGE="$ROOT/dist/pkgroot-${ARCH}"
PKG="$ROOT/dist/printflow-bridge_${VERSION}_darwin_${ARCH}.pkg"

if [[ ! -f "$BIN" ]]; then
  echo "Binary yok: $BIN — önce build-all.sh"
  exit 1
fi

rm -rf "$STAGE"
mkdir -p "$STAGE/usr/local/bin" "$STAGE/Library/LaunchAgents" "$STAGE/Library/Logs/PrintFlow Bridge"
install -m 755 "$BIN" "$STAGE/usr/local/bin/printflow-bridge"
install -m 644 "$ROOT/installers/resources/com.printflow.bridge.plist" "$STAGE/Library/LaunchAgents/com.printflow.bridge.plist"

# URL şeması: Info.plist parçası (kurulum sonrası lsregister)
mkdir -p "$STAGE/usr/local/share/printflow-bridge"
cat > "$STAGE/usr/local/share/printflow-bridge/URLScheme.txt" <<EOF
printflow://pair?code=XXXXXX&url=https://your-printflow-app
EOF

if [[ -n "${SIGN_IDENTITY:-}" ]]; then
  codesign --force --options runtime --sign "$SIGN_IDENTITY" "$STAGE/usr/local/bin/printflow-bridge"
fi

pkgbuild --root "$STAGE" \
  --identifier com.printflow.bridge \
  --version "$VERSION" \
  --install-location / \
  "$PKG"

if [[ -n "${SIGN_IDENTITY:-}" ]]; then
  productsign --sign "$SIGN_IDENTITY" "$PKG" "${PKG%.pkg}-signed.pkg"
  mv "${PKG%.pkg}-signed.pkg" "$PKG"
fi

echo "→ $PKG"
