#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="${PRINTFLOW_BRIDGE_VERSION:-0.1.0}"
BIN="$ROOT/dist/printflow-bridge_${VERSION}_linux_amd64"
DEB="$ROOT/dist/printflow-bridge_${VERSION}_linux_amd64.deb"
STAGE="$ROOT/dist/debroot"

if [[ ! -f "$BIN" ]]; then
  echo "Binary yok: $BIN"
  exit 1
fi

rm -rf "$STAGE"
mkdir -p "$STAGE/DEBIAN" "$STAGE/usr/bin" "$STAGE/usr/lib/systemd/user"
install -m 755 "$BIN" "$STAGE/usr/bin/printflow-bridge"
install -m 644 "$ROOT/installers/resources/printflow-bridge.service" "$STAGE/usr/lib/systemd/user/printflow-bridge.service"

cat > "$STAGE/DEBIAN/control" <<EOF
Package: printflow-bridge
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: amd64
Maintainer: PrintFlow <support@printflow.app>
Description: PrintFlow atölye köprüsü (Bambu, Creality, Anycubic, …)
 Tek kurulum; tarayıcı eklentisi gerekmez.
EOF

cat > "$STAGE/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
if command -v systemctl >/dev/null 2>&1; then
  systemctl --user daemon-reload || true
  systemctl --user enable printflow-bridge.service || true
  systemctl --user start printflow-bridge.service || true
fi
EOF
chmod 755 "$STAGE/DEBIAN/postinst"

dpkg-deb --build "$STAGE" "$DEB"
echo "→ $DEB"
sha256sum "$DEB" > "$DEB.sha256"
