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
npm run build:all             # 在具备构建条件的环境中生成全部三个安装包
```

正式安装包保存在 `dist/版本号/`。每个版本目录只保留三个安装包，后续版本自动创建各自目录。例如：

```text
dist/1.0.6/
  秋秋音乐-1.0.6-macos-arm64.dmg
  秋秋音乐-1.0.6-macos-x64.dmg
  秋秋音乐-1.0.6-windows-x64.exe
```

中间应用目录、构建日志和 blockmap 生成在系统临时目录，成功后自动清理；构建失败时会打印诊断目录位置。分别构建不同平台时，会将安装包归入同一版本目录。

GitHub Release 上传会过滤中文文件名。如需 ZIP 传输副本，请在系统临时目录制作，保留其中安装包的 UTF-8 中文名称，并在 README 中标明下载的是 ZIP。正式版本目录只保存上述三个安装包。

桌面悬浮球可按住唱片拖动，轻点恢复主播放器，右上角 X 退出应用；它只在 Mac/Windows 桌面版运行。iPhone 和 Android 继续使用网页/PWA 播放器；移动系统不允许普通网页在应用关闭后保留系统级悬浮窗。Mac 安装包当前未做 Developer ID 公证签名，首次打开可能需要在系统设置中允许运行。
