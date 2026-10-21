#!/bin/bash
# =============================================================
# package-deb.sh —— 把 build/ 下产物打成可 dpkg -i 安装的 deb
#
# ⚠️ 关键：Architecture 必须是 iphoneos-arm64e
#   `dpkg --print-architecture` 在 macOS runner 上返回 darwin-arm64，
#   那样打出来的 deb 装到越狱机上会报
#   "package architecture does not match system"。
#   所以这里硬编码设备架构，A14 + relaxin 已验证。
#   需要改架构就改这一行。
# =============================================================
set -euo pipefail

PKG=minictl
VER=1.0.0
DEB_ARCH=iphoneos-arm64e

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$STAGE/DEBIAN" "$STAGE/usr/bin"
cp build/* "$STAGE/usr/bin/"

cat > "$STAGE/DEBIAN/control" <<EOF
Package: $PKG
Name: Mini Control Tool
Version: $VER
Architecture: $DEB_ARCH
Section: Utilities
Priority: optional
Maintainer: local <local@localhost>
Description: iOS command-line utility built via GitHub Actions macOS runner
 Uses the real iOS SDK and Xcode toolchain from the runner image.
 Install on jailbroken device with: dpkg -i ${PKG}_${VER}_${DEB_ARCH}.deb
EOF

mkdir -p dist
dpkg-deb --root-owner-group -b "$STAGE" "dist/${PKG}_${VER}_${DEB_ARCH}.deb"

echo "──── deb ────"
ls -la dist/
echo
dpkg-deb -I "dist/"*.deb | sed 's/^/  /'
echo
dpkg-deb -c "dist/"*.deb | sed 's/^/  /'