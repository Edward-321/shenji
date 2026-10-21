---
name: iOS Cloud Build (GitHub Actions)
---

# 云编译 vs 本地工具链

| | 本地 (iSH) | 云端 (GitHub Actions macos-14) |
|---|---|---|
| 环境 | Alpine aarch64 沙盒 | 真 macOS + 完整 Xcode + iOS SDK |
| 系统库 | 手写 `.tbd` 桩（`/usr/local/lib/iostubs`） | SDK 自带，**无需桩** |
| 可链接 | 纯 C / POSIX | Foundation / UIKit / 任意 framework |
| 语言 | C | C / Objective-C / Swift |
| 签名 | `ldid -S` | `ldid -S`（brew 装） |
| 速度 | 手机 CPU，慢 | 云端多核，快 |
| 额度 | 无限 | 公开仓库免费；私有 2000 分钟/月 |

## 用法

1. 本目录推到 GitHub（`main` 分支）
2. 每次 push 触发 → Actions 页看构建日志
3. 构建完在 Artifacts 下载 `ios-build`（含二进制 + deb）
4. 把 `.deb` 传到越狱机 → Filza 终端 root 跑 `dpkg -i`

## 关键点

- **deb 架构字段必须是 `iphoneos-arm64e`**（A14 + relaxin 越狱），不是 `iphoneos-arm64`
- `-miphoneos-version-min=15.0` 对 iOS 17.1.2 设备安全（向上兼容）
- 不需要 `brew install dpkg` 也行，GitHub runner 自带；但显式装更稳

## 加新程序

往 `src/` 丢 `.c`，文件名 = 二进制名，自动全部编译打包。

```c
int main(void) {
    /* ... */
    exit(0);   // 注意：必须 exit(0)，return 会退回 dyld 崩溃
}
```

## 加 Objective-C / Swift

改 `build.sh`：把 `-framework UIKit` 保留，`.m` 需 `-fobjc-arc`，`.swift` 走单独 `swiftc` 调用。