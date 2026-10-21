#!/bin/bash
# =============================================================
# build.sh —— GitHub Actions (macOS runner) iOS 构建脚本
#
# 与 iSH 侧 ssbuild.sh 的区别：
#   · runner 自带完整 Xcode + iOS SDK → 直接 -isysroot，不需要手写 .tbd 桩
#   · 可以自由链接系统 framework（UIKit / Foundation / ...）
#   · 可以编译 Objective-C / Swift（改下方 OBJC/SWIFT 开关）
# =============================================================
set -euo pipefail

SDK=$(xcrun --sdk iphoneos --show-sdk-path)
CLANG=$(xcrun --sdk iphoneos clang)
TARGET_VER=15.0          # 与设备 iOS 17.1.2 兼容（向上兼容安全）
ARCH=arm64e              # 越狱机 A14 = arm64e

mkdir -p build

# 编译 src/ 下所有 .c
shopt -s nullglob
SOURCES=(src/*.c)
if [ ${#SOURCES[@]} -eq 0 ]; then
  echo "[!] src/ 下没有 .c 文件"
  exit 1
fi

for SRC in "${SOURCES[@]}"; do
  NAME=$(basename "${SRC%.c}")
  echo "── 编译 $NAME"
  "$CLANG" \
    -arch "$ARCH" \
    -isysroot "$SDK" \
    -miphoneos-version-min="$TARGET_VER" \
    -O2 \
    -Wall \
    -c "$SRC" \
    -o "build/$NAME.o"

  "$CLANG" \
    -arch "$ARCH" \
    -isysroot "$SDK" \
    -miphoneos-version-min="$TARGET_VER" \
    -fuse-ld=ld64 \
    -o "build/$NAME" \
    "build/$NAME.o" \
    -framework Foundation \
    -framework UIKit \
    -framework ObjectiveC

  rm -f "build/$NAME.o"

  # 签名（越狱机用 ldid ad-hoc 即可）
  ldid -S "build/$NAME"
  chmod 755 "build/$NAME"

  echo "   ✓ $NAME"
done

echo
echo "──── 产物校验 ────"
for F in build/*; do
  file "$F" | sed 's/^/  /'
  otool -L "$F" 2>/dev/null | tail -n +2 | sed 's/^/  /' || true
  ldid -h "$F" 2>&1 | grep -E 'CDHash' | sed 's/^/  /' || true
done