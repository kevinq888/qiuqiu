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
npm run build:mac  # macOS .dmg
npm run build:win  # Windows 安装程序
```

目前构建未配置开发者签名；macOS 首次打开可能需要在系统设置中确认允许运行。浏览器/PWA 本身无法提供应用退出后仍存在的桌面悬浮窗，此行为只在桌面版中可用。
