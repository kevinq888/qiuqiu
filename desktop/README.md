# 秋秋音乐桌面版

桌面版通过 Electron 打开线上秋秋音乐。点主窗口的最小化或关闭时，主窗口会隐藏到系统托盘，音乐继续播放，独立黑胶悬浮球保持置顶。点黑胶球可重新打开主窗口；右上角 × 或托盘菜单的“退出秋秋音乐”会结束播放并退出程序。

## 本机运行

```sh
cd desktop
npm install
npm start
```

可用 `QIUQIU_URL` 指向测试站点，例如 `QIUQIU_URL=http://localhost:3000 npm start`（在 `desktop` 目录中运行）。

## 打包

```sh
npm run build:mac -- --x64    # Intel Mac .dmg
npm run build:mac -- --arm64  # Apple Silicon Mac .dmg
npm run build:win             # Windows NSIS 安装程序（在 Windows 环境构建）
```

安装包保存在 `dist/`，统一使用 `秋秋音乐-版本号-系统-架构` 命名，例如 `秋秋音乐-1.0.6-macos-arm64.dmg`、`秋秋音乐-1.0.6-windows-x64.exe`。后续版本继续使用该规则。

GitHub Release 上传会过滤中文文件名。发布时请将安装包封装到保留 UTF-8 文件名的 ZIP，确保解压后的安装包仍以“秋秋音乐-”开头，并在 README 中标明下载的是 ZIP。

桌面悬浮球可按住唱片拖动，轻点恢复主播放器，右上角 X 退出应用；它只在 Mac/Windows 桌面版运行。iPhone 和 Android 继续使用网页/PWA 播放器；移动系统不允许普通网页在应用关闭后保留系统级悬浮窗。Mac 安装包当前未做 Developer ID 公证签名，首次打开可能需要在系统设置中允许运行。
