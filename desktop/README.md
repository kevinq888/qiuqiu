# 秋秋音乐桌面版

从 1.1.0 起，桌面版将界面、Node 后端、基础曲库和静态资源一并打包，在本机运行，不加载 Render 网站。点主窗口的最小化或关闭时，主窗口会隐藏到系统托盘，音乐继续播放，独立黑胶悬浮球保持置顶。点黑胶球可重新打开主窗口；右上角 × 或托盘菜单的“退出秋秋音乐”会结束播放并退出程序。

## 本机运行

```sh
cd desktop
npm install
npm start
```

### 本地架构

- 主窗口固定使用 `qiuqiu://app/`，通过 Electron 协议桥接到内置 Node 服务。服务只监听 `127.0.0.1` 随机端口，并校验每次启动生成的随机令牌；不对局域网开放。
- 安装包的 `resources/backend/` 包含 `server.js`、`src/`、`public/` 和 `data/seed.json`。首页直接读取基础曲库，不等待线上接口或远程字体。
- 随机端口不会改变界面 origin，因此升级和重启不会因端口变化丢失收藏、歌单和播放进度。
- 音频缓存、搜索缓存及本机统计保存在 Electron `userData/data/`（macOS：`~/Library/Application Support/qiuqiumusic-desktop/data/`；Windows：`%APPDATA%/qiuqiumusic-desktop/data/`）。安装目录只读也可以运行，卸载/重装时请保留用户数据以保留记录。
- 首次升级从旧桌面版的存储域迁移 `qiuqiumusic.*` 数据。迁移时以本地空白文档拦截旧地址，不访问 Render，不覆盖已有本地数据，不删除旧记录；这不包含其他浏览器里的记录。
- 在线搜索、榜单刷新和未缓存音频仍访问外部音源；已缓存的音频可以断网播放。缓存有 60 天有效期及 512 MB 容量限制，不等同于永久离线下载。
- 退出时关闭本地 HTTP 服务和连接，没有独立后台服务进程残留。网页端继续使用原来的独立部署方式。

`QIUQIU_URL` 不再用于桌面端，无法将主窗口切回远程网站。

## 验证

在桌面环境运行 `npm run test:local`。测试使用隔离的临时用户目录，阻断外部请求，验证旧数据迁移、首页、缓存音频播放与 Range、POST 接口、悬浮控制和退出重启后的进度恢复，不接触实际用户数据。

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
