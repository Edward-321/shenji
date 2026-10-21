#!/bin/bash
# =============================================================
# build.sh —— GitHub Actions (macOS runner) iOS 构建脚本
#
# 与 iSH 侧 ssbuild.sh 的区别：
#   · runner 自带完整 Xcode + iOS SDK → 直接 -isysroot，不需要手写 .tbd 桩
#   · 可以自由链接系统 framework（UIKit / Foundation / ...）
#   · 可以编译 Objective-C / Swift（见下方 FRAMEWORKS 自动探测）
#
# 踩过的坑：
#   1) `xcrun --sdk iphoneos clang`（不带 --find）会「执行」clang 而不是打印路径，
#      无输入文件时报 "clang: error: no input files" → set -e 直接退出。
#      必须用 `xcrun --sdk iphoneos --find clang`。
#   2) Apple clang 不接受 `-fuse-ld=ld64`，报 "invalid linker name"；
#      它的默认链接器本来就是 ld64，这参数在 Linux clang 上才有意义。
# =============================================================
set -euo pipefail

SDK=$(xcrun --sdk iphoneos --show-sdk-path)
CLANG=$(xcrun --sdk iphoneos --find clang)
TARGET_VER=15.0          # 设备 iOS 17.1.2，向上兼容安全
ARCH=arm64e              # A14 + relaxin 越狱机

rm -rf build
mkdir -p build

shopt -s nullglob
SOURCES=(src/*.c)
if [ ${#SOURCES[@]} -eq 0 ]; then
  echo "[!] src/ 下没有 .c 文件"
  exit 1
fi

# framework 链不链无所谓但不链更干净：
#   纯 C 程序 → 只用 libSystem（clang 驱动自动加）
#   用了 ObjC → 需要 Foundation（UIKit 才是 UI 层）
FRAMEWORKS=()
if grep -qE '@interface|@implementation|#import <Foundation|#import <UIKit' "${SOURCES[@]}" 2>/dev/null; then
  FRAMEWORKS=(-framework Foundation -framework ObjectiveC)
  if grep -qE '#import <UIKit|UIApplication|UIViewController' "${SOURCES[@]}" 2>/dev/null; then
    FRAMEWORKS+=(-framework UIKit)
  fi
  echo "[i] 检测到 Objective-C，链接: ${FRAMEWORKS[*]}"
else
  echo "[i] 纯 C，仅链 libSystem"
fi

for SRC in "${SOURCES[@]}"; do
  NAME=$(basename "${SRC%.c}")
  echo "── 编译 $NAME"

  "$CLANG" \
    -arch "$ARCH" \
    -isysroot "$SDK" \
    -miphoneos-version-min="$TARGET_VER" \
    -O2 -Wall \
    -c "$SRC" \
    -o "build/$NAME.o"

  "$CLANG" \
    -arch "$ARCH" \
    -isysroot "$SDK" \
    -miphoneos-version-min="$TARGET_VER" \
    -o "build/$NAME" \
    "build/$NAME.o" \
    "${FRAMEWORKS[@]+"${FRAMEWORKS[@]}"}"

  rm -f "build/$NAME.o"

  # 越狱机用 ldid ad-hoc 签名即可
  ldid -S "build/$NAME"
  chmod 755 "build/$NAME"
  echo "   ✓ $NAME"
done

echo
echo "──── 产物校验 ────"
for F in build/*; do
  echo "── $F"
  file "$F" | sed 's/^/   /'
  otool -L "$F" 2>/dev/null | tail -n +2 | sed 's/^/   /' || true
  ldid -h "$F" 2>&1 | grep -E 'CDHash' | sed 's/^/   /' || true
done