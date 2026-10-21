#!/bin/bash
# =============================================================
# mkrepo.sh —— 自己的 Sileo/Cydia 源构建流水线
#
# 用法: mkrepo.sh [仓库目录]
#   · 把要发布的 .deb 放进 <仓库>/debs/
#   · 自动生成 Packages / Packages.gz / Packages.bz2 / Release
#
# 发布方式 (二选一):
#   A. GitHub Pages: 把 <仓库>/ 内容推到 gh-pages 分支
#   B. 本地托管:     在设备上装 HTTP 服务器指向 <仓库>/
# =============================================================
set -e

REPO="${1:-/var/minis/workspace/ios-toolchain/repo}"
DEBS="$REPO/debs"
export PATH=/usr/local/bin:$PATH

mkdir -p "$DEBS"

nice_date() { date -u +"%a, %d %b %Y %H:%M:%S UTC"; }
size_of() { wc -c < "$1" | tr -d ' '; }
md5_of()  { md5sum "$1" | awk '{print $1}'; }
sha1_of() { sha1sum "$1" | awk '{print $1}'; }
sha256_of(){ sha256sum "$1" | awk '{print $1}'; }

echo "════════════════════════════════════════════"
echo "  Sileo 源构建器 -> $REPO"
echo "════════════════════════════════════════════"

# ---------- 1. 检查 debs ----------
N=$(ls "$DEBS"/*.deb 2>/dev/null | wc -l | tr -d ' ')
if [ "$N" = "0" ]; then
  echo "  [x] $DEBS 里没有 .deb —— 先用 build-pkg.sh 打包"
  exit 1
fi
echo "[1] 发现 $N 个 .deb"
ls -la "$DEBS"/*.deb | awk '{printf "      %-50s %s\n", $NF, $5}'
echo

# ---------- 2. 生成 Packages ----------
echo "[2] 扫描生成 Packages"
cd "$DEBS"
dpkg-scanpackages -m . /dev/null > "$REPO/Packages" 2>/dev/null
P=$(wc -l < "$REPO/Packages" | tr -d ' ')
echo "      $P 行"
echo

# ---------- 3. 压缩 ----------
echo "[3] 压缩"
gzip -9 -c "$REPO/Packages" > "$REPO/Packages.gz"
bzip2 -c "$REPO/Packages" > "$REPO/Packages.bz2"
xz -9 -c  "$REPO/Packages" > "$REPO/Packages.xz"
echo "      Packages.gz/bz2/xz 已生成"
echo

# ---------- 4. 生成 Release ----------
ARCHES=$(awk '/^Architecture:/{print $2}' "$REPO/Packages" | sort -u | tr '\n' ' ')
RELEASE="$REPO/Release"
DATEE=$(nice_date)

{
  echo "Origin: jie自用"
  echo "Label: jie自用"
  echo "Suite: stable"
  echo "Version: 1.0"
  echo "Codename: ios"
  echo "Architectures: $ARCHES"
  echo "Components: main"
  echo "Description: 自定义 iOS 软件源 (iSH 构建)"
  echo "Date: $DATEE"
  echo "Acquire-By-Hash: no"
  echo
  echo "MD5Sum:"
  for f in Packages Packages.gz Packages.bz2 Packages.xz; do
    printf " %s %s %s\n" "$(md5_of "$REPO/$f")" "$(size_of "$REPO/$f")" "$f"
  done
  echo "SHA1:"
  for f in Packages Packages.gz Packages.bz2 Packages.xz; do
    printf " %s %s %s\n" "$(sha1_of "$REPO/$f")" "$(size_of "$REPO/$f")" "$f"
  done
  echo "SHA256:"
  for f in Packages Packages.gz Packages.bz2 Packages.xz; do
    printf " %s %s %s\n" "$(sha256_of "$REPO/$f")" "$(size_of "$REPO/$f")" "$f"
  done
} > "$RELEASE"
echo "[4] Release 已生成:"
sed 's/^/      /' "$RELEASE"
echo

echo "════════════════════════════════════════════"
echo "  源目录结构:"
find "$REPO" -maxdepth 2 -type f | sed 's/^/    /'
echo
echo "  源地址 (GitHub Pages):"
echo "    https://<你的用户名>.github.io/<仓库名>/"
echo
echo "  源地址 (本地 LAN):"
echo "    http://<设备IP>:8899/"
echo "════════════════════════════════════════════"