#!/bin/bash
# =============================================================
# package-deb.sh —— 把 build/ 下产物打成可 dpkg -i 安装的 deb
#
# 架构字段必须是 iphoneos-arm64e（不是 iphoneos-arm64！）
# 否则设备上 dpkg -i 报 "package architecture does not match system"
# =============================================================
set -euo pipefail

PKG=minictl
VER=1.0.0
ARCH=$(dpkg --print-architecture 2>/dev/null || echo iphoneos-arm64e)

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$STAGE/DEBIAN" "$STAGE/usr/bin"
cp build/* "$STAGE/usr/bin/"

# 获取真实架构（设备侧架构才是最终答案）
ARCH=$(dpkg-deb --help >/dev/null 2>&1 && dpkg --print-architecture 2>/dev/null || echo "")

cat > "$STAGE/DEBIAN/control" <<EOF
Package: $PKG
Name: Mini Control Tool
Version: $VER
Architecture: ${ARCH:-iphoneos-arm64e}
Description: Built via GitHub Actions on macOS runner
 Maintainer: local
EOF

mkdir -p dist
dpkg-deb --root-owner-group -b "$STAGE" "dist/${PKG}_${VER}_${ARCH:-iphoneos-arm64e}.deb"

echo "──── deb ────"
ls -la dist/
dpkg-deb -I "dist/"*.deb | sed 's/^/  /'
dpkg-deb -c "dist/"*.deb | sed 's/^/  /'