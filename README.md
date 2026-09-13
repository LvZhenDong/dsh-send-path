# dsh-send-path

一键把**资源管理器右键选中的文件/文件夹绝对路径**发送到 **DeepSeek Harness (DSH)** 的对话框输入框。
One-click send of the **absolute path** of the right-clicked file/folder into the **DeepSeek Harness (DSH)** dialog input.

> 右键 → 按 `F` → 路径直达对话框。
> Right-click → press `F` → the path lands in the dialog.

## 为什么需要它 / Why

浏览器出于安全原因，**不会**把拖入文件的绝对路径暴露给网页（只有文件名/大小）。所以"拖文件进对话框"拿不到真实路径。
Browsers deliberately hide the absolute path of dragged files. Drag-and-drop into the web dialog can never see the real path.

**右键菜单由资源管理器调用原生进程，路径由 Explorer 直接传入**——精确、无搜索、深层目录和重名都不受影响。
The Explorer context menu runs a native process and receives the exact path from Explorer itself — precise, no searching, works for any depth or duplicate names.

## 工作原理 / How it works

```
Explorer right-click (files & folders)
   │  wscript → send-path.vbs（路径由 Explorer 直接传入）
   ▼
drop-resolver (local loopback service, 127.0.0.1:3081, zero-dependency Node)
   │  POST /insert → SSE /events（含历史回放，断线不丢帧）
   ▼
patched DSH web bundle (EventSource listener)
   ▼
path inserted into the composer input
```

## 系统要求 / Requirements

- Windows 10/11
- Node.js（DSH 本身运行在 Node 上，装 DSH 即已具备）
- 已安装并运行 DeepSeek Harness（`dsh web`），浏览器打开着 GUI 页面

## 快速开始 / Quick start

```bat
git clone https://github.com/LvZhenDong/dsh-send-path.git
cd dsh-send-path
install.cmd
```

然后：**重启一次资源管理器**（任务管理器 → Windows 资源管理器 → 重启），右键任意文件/文件夹 → 菜单里出现「发送到 DSH 输入框(F)」→ 按 `F` 即发送。
Then: **restart Explorer** once, right-click any file/folder, press `F` while the menu is open.

- 安装**无需管理员**：只写 `HKCU` 注册表和用户目录。
- 安装脚本会自动定位并**修补 DSH 的 ui-attachment bundle**（幂等：已修补则跳过；首次修补自动备份原文件）。DSH 的 client-hmr 会自动热更新已打开的页面，否则刷新一次。
- resolver 已注册**开机自启**。

卸载：`uninstall.cmd`（还原 bundle、删除菜单/自启、停止服务）。

## 使用细节 / Usage

- **多选**：Explorer 会为每个选中的文件各调用一次，路径逐行插入。
- **文件夹**：同样支持（精确路径）。
- 快捷键 `F` 是**左手食指主键位**（右键时右手在鼠标上）。想换字母：改 `install.ps1` 里的 `$label`（如 `发送到 DSH 输入框(&H)`），重跑安装。

## 配置 / Configuration

| 项 | 默认 | 说明 |
|---|---|---|
| 服务端口 | `127.0.0.1:3081` | 改端口需同时改 `src/resolver.mjs`（环境变量 `DSH_RESOLVER_PORT`）与修补脚本注入的 `RESOLVER_URL` |
| 菜单标签/快捷键 | `发送到 DSH 输入框(&F)` | 见 install.ps1 `$label` |
| 菜单图标 | `src/dsh-menu.ico`（DSH 鲸鱼标，品牌蓝） | 换图标：替换该文件或改 `Icon` 注册表值 |

## 常见问题 / FAQ

- **菜单里没出现该项**：重启资源管理器；确认 `install.cmd` 成功运行。
- **按 F 没反应**：确认 DSH 页面开着（resolver 只把消息推给已连接的页面）。resolver 未运行时**右键脚本会自动拉起它并重试**，无需手动操作，也不会弹任何错误框。
- **修补脚本找不到 bundle**：DSH 未安装或装在非常规位置——用 `node tools\patch-dsh-bundle.mjs --bundle <path\to\client.js>` 指定。
- **DSH 更新后失效**：DSH 更新会覆盖 bundle，重跑 `install.cmd` 即可（幂等）。

## 项目结构 / Layout

```
src/resolver.mjs          loopback service: /insert, /events (SSE), /health
src/send-path.vbs         context-menu bridge (POSTs the exact path; if the service is down it starts it, waits for /health, then inserts once — never shows a dialog)
src/start-resolver.vbs     hidden autostart launcher (portable node lookup)
src/stop-resolver.cmd      manual stop
src/dsh-menu.ico           menu icon
tools/patch-dsh-bundle.mjs idempotent bundle patcher (+ --restore)
tools/e2e-menu.mjs         end-to-end regression test (headless Edge)
install.cmd / install.ps1  one-click install (no admin)
uninstall.cmd / uninstall.ps1
```

## 测试 / Testing

`tools/e2e-menu.mjs` 用无头 Edge 打开真实 DSH 页面，模拟右键菜单调用，断言路径进入输入框：
`node tools\e2e-menu.mjs "C:\path\to\file.txt"`

## 免责声明 / Disclaimer

本项目与 DeepSeek 无关联，非官方出品。图标中的鲸鱼标为 DeepSeek 的品牌标识，仅用于指明目标应用，请遵守 [DeepSeek Harness 品牌使用规范](https://github.com/deepseek-ai/deepseek-harness/blob/main/BRAND_GUIDELINES.md)。MIT 许可，见 [LICENSE](LICENSE)。

## License

MIT © LvZhenDong
