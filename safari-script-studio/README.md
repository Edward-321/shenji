# 澄页 · Safari Script Studio 0.1

原创、实验性的 Safari Web Extension 源码。不是已经签名的 IPA，也不是 Tampermonkey 官方扩展。三个配套脚本为原创实现，不包含第三方商业扩展或未注明授权的脚本合集。

## 已实现
- 中文、明暗主题、iPhone 自适应管理页；工具栏弹窗。
- `.user.js` 多选、目录导入、粘贴编辑、JSON 批量导入/源码备份。
- 每批 25 个写入、每页 40 条、搜索、开关、删除、全局/站点暂停。
- @match / @include / @exclude / @exclude-match、@noframes、基本 @run-at。
- 按脚本分离存储；仅匹配脚本取回源码。导入默认关闭，启用前确认。
- 三组内置脚本，管理页点“导入三组内置脚本”即可导入；也可导入 bundled-scripts.json。

## 三组功能及限制
1. **网页修复**：恢复常见选择、复制、右键事件默认行为；保守删除 utm/fbclid 等参数；已知 App 协议链接拦截可选。不保证恢复复杂自绘页面、粘贴处理或程序驱动的强制跳转。不读写系统剪贴板。
2. **保守净化**：隐藏少量已知 Cookie 平台组件；菜单可恢复。不会自动接受/拒绝 Cookie，不代表阻止网站跟踪。不泛化删除所有弹窗、登录框或付费墙。
3. **工具箱**：脚本菜单打开可拖动面板。可选媒体 URL 列表、少量广告外观过滤、本站 CSS、自动滚动、Google 中文翻译跳转。默认关闭；翻译每次确认，完整 URL 会发送给 Google，对方可能处理页面内容。不是任意网页的无缝自动翻译。不解密 DRM、不获取跨域响应或 blob/MSE 内容。广告仅 CSS 隐藏，不是网络广告拦截器。

“海量”指批量管理设计，不含海量第三方脚本库，不承诺无限容量。目录导入取决于 Safari 的文件选择器支持，iPhone 上可以改用 JSON。实际容量受设备内存、存储配额和 Xcode/Safari 限制。

## 油猴兼容范围
支持同步 GM_getValue、GM_setValue（返回 Promise）、GM_deleteValue、GM_listValues、GM_addStyle、GM_registerMenuCommand / GM_unregisterMenuCommand、GM_info，以及对应部分 GM.* 异步方法。同步读值是本页加载快照，不跨标签即时同步；同一后台存活期间写入串行化，不保证后台重启的跨进程事务。

不支持 GM_xmlhttpRequest、GM_download、unsafeWindow、@require、@resource、页面主世界注入、完整 @connect、自动远程更新、ZIP 或 Tampermonkey 原生导出格式。检测出的未知授权和依赖默认禁止启用。没有授权的脚本也在扩展隔离世界运行，语义与完整 Tampermonkey 不同。

## 重要安全/兼容边界
这是**可信脚本执行器，不是恶意代码沙箱**。new Function 在扩展内容脚本隔离世界运行，脚本可能接触宿主可见的 WebExtension API；@grant 仅控制提供的兼容函数，不能作为权限安全边界。不要导入不可信代码。网页修复可能妨碍网站自身的事件处理。

使用 Manifest V2 和 `unsafe-eval` 实现动态用户脚本执行。Safari 对 MV2、扩展 CSP、隔离世界动态代码执行及 App Store 审核的限制必须在目标 Xcode/Safari 版本实测。本环境仅完成 JS 语法、规则单测与管理界面预览，**未在真正 Safari 扩展环境验收**。若目标 Safari 阻止动态执行，须改用经目标平台验证的用户脚本注入架构，不能移除 CSP 或改注入页面来冒充安全兼容。

内容脚本先异步读本地存储，因此 document-start 是尽早执行而非保证早于站点脚本；已运行脚本的关闭/暂停需刷新页面。本站 CSS 可能包含发往第三方的 url()/@import，请只使用可信内容。

## Mac / Xcode 构建
需要装好 Xcode 与命令行工具。在本目录执行：

```sh
xcrun safari-web-extension-converter ./extension \
  --project-location ./build \
  --app-name ScriptStudio \
  --bundle-identifier com.local.scriptstudio \
  --swift
```

按转换器输出打开工程，选择 iOS 宿主 App 与 Safari Web Extension 目标，设置自己的唯一 Bundle ID 和 Signing Team。若转换器只生成 macOS 目标，在 Xcode 中添加 iOS Safari Web Extension/宿主目标并关联同一资源。具体选项以本机 `xcrun safari-web-extension-converter --help` 为准。

连接 iPhone，选择宿主 App scheme → Run。不能只把 ZIP 或 `.user.js` 当 IPA 安装。免费开发签名的有效期和能力以 Apple 当前政策为准，分发/App Store 还需对应签名及审核。

iPhone：设置 → App → Safari → 扩展 → 启用 ScriptStudio，并按需授予网站访问权限。Safari 页面菜单打开扩展 → 管理/导入脚本 → 导入内置 → 逐个启用 → 刷新目标网页。工具箱入口位于扩展弹窗里的脚本菜单。不同 iOS 版本设置路径可能不同。

## 0.2.0 更新（2026-10-26）
- **三个内置脚本改中文名**：网页修复 / 弹窗清理 / 网页工具箱（版本 1.1.0）。旧版英文条目会在扩展启动时自动清理，重装后重新导入内置即可，启用状态会保留。
- **页内翻译，不跳转、不用代理**：删除了跳转 Google 翻译的逻辑（实测设备所在网络 `translate.googleapis.com` 完全不可达）。改为在页面内直接替换文本节点，由扩展后台代理调用第三方接口并做批量、限流、缓存与行对齐校验。
  - 默认服务：有道公开接口 `aidemo.youdao.com/trans`（免密钥，实测单次 ≤1000 字符，本扩展按 800 字符分批；多行按 `\n` 对齐还原）。
  - 备用服务：MyMemory `api.mymemory.translated.net`（免密钥，实测单次 ≤480 字符，按 400 字符分批）。
  - 提供「翻译本页为中文」「停止翻译」「还原原文」，面板显示进度。自动翻译按 origin 保存且默认关闭。
  - **隐私**：待翻译文本会发送给上述第三方服务，不要用于含隐私或令牌的页面。接口为公开非官方接口，可能限流或失效。
- **工具箱改为侧边悬浮吸附**：打开页面即有一个贴边把手（默认右侧、垂直居中），点击展开/收起，拖动后自动吸附到上/中/下三档，可换边；位置、是否显示把手、是否自动展开面板都按 origin 保存。
- 新增扩展图标（48/96/128/256/512）。

### 需要额外授予的权限
manifest 新增了 `*://aidemo.youdao.com/*` 与 `*://api.mymemory.translated.net/*`。iPhone 上要到 **设置 → Safari → 扩展 → 澄页 → 网站访问** 设为「允许」（或全部允许），否则后台翻译请求会被拒绝。

## 预览与测试
直接打开 extension/manager.html 可预览 UI；此时仅使用 localStorage，不会影响 Safari 网页，数据也不会进入安装后的扩展。

```sh
node tests/core.test.cjs
find extension -name '*.js' -exec node --check {} \;
```

验收还需真实设备验证：扩展 CSP/动态执行、访问授权、首次导入、三个脚本开关、菜单、持久化、iOS 后台唤醒、不同站点兼容。测试前不要声称已可安装或完全兼容油猴。
