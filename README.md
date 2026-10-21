# 秋秋音乐（qiuqiumusic）

秋秋音乐是一个 Node.js 在线音乐应用，提供歌曲搜索、榜单、歌手与歌单浏览、收藏和播放清单。网页端的收藏及播放清单保存在当前浏览器。

## 桌面版下载

桌面版提供 Windows 和 macOS 安装包。下载后按系统提示完成安装；桌面版支持系统托盘和黑胶悬浮球。手机和平板请直接访问[在线版](https://qiuqiumusic.onrender.com/)，或按下方说明添加到主屏幕。

### v1.2.3（当前版本）

- 播放清单打开时，点击面板与开关以外的任意位置自动收回。
- 桌面客户端内嵌站点同步 v1.2.2 全部清单与缓存改进。

安装包位于 `desktop/dist/1.2.3/`，目录仅包含以下三个文件。ZIP 下载后先解压。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.3/1.2.3-macos-arm64.zip) | 秋秋音乐-1.2.3-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.3/1.2.3-macos-x64.zip) | 秋秋音乐-1.2.3-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.3/1.2.3-windows-x64.zip) | 秋秋音乐-1.2.3-windows-x64.exe |

### v1.2.2

- 加入播放清单后自动从第一首开始播放，并在后台按顺序逐首缓存，切歌更快。
- 播放清单新增缓存进度条，颜色跟随当前皮肤；已缓存、缓存中、待缓存一眼可分。
- 清单按钮显示"当前曲目/总数"（如 3/20），点开后自动定位并高亮当前曲目。
- 音频缓存有效期调整为 1 周，一周未被播放的曲目自动清理，相关文案同步更新。
- 网页顶栏的"安装"入口更名为"保存链接"，点击即可复制站点链接；桌面客户端内隐藏该入口。

安装包位于 `desktop/dist/1.2.2/`，目录仅包含以下三个文件。ZIP 下载后先解压。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.2/1.2.2-macos-arm64.zip) | 秋秋音乐-1.2.2-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.2/1.2.2-macos-x64.zip) | 秋秋音乐-1.2.2-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.2/1.2.2-windows-x64.zip) | 秋秋音乐-1.2.2-windows-x64.exe |

### v1.2.1

- GitHub 匿名 API 限流时，使用官方仓库发布清单检查更新，无需用户登录 GitHub。
- 修复音源响应断线可能导致桌面进程退出的问题；播放失败会保留明确提示，点击播放可重新加载音源并重试。
- 调整应用图标唱片比例，与大唱片圆角图标参考保持一致。

- 桌面顶栏新增更新提醒：发现正式新版本后显示，点击一次自动匹配系统和芯片、下载、核对 SHA-256、保存播放记录、安装并重启。
- 下载期间可继续听歌；重启后恢复歌曲、进度及更新前的播放状态。页面切换不丢失更新进度，重复点击不会创建多次更新。
- 使用官方 GitHub Releases，不依赖 Render；校验失败不替换应用。Mac 新版启动失败会恢复备份。Windows 使用 NSIS 静默安装，失败保留恢复副本；系统要求的权限提示仍会显示。
- 1.1.0 及更早版本需先手动安装一次本版本，之后才具备一键更新能力。安装位置必须可写；Mac 请先将应用移入“应用程序”目录。

安装包位于 `desktop/dist/1.2.1/`，目录仅包含以下三个文件。ZIP 下载后先解压。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.1/1.2.1-macos-arm64.zip) | 秋秋音乐-1.2.1-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.1/1.2.1-macos-x64.zip) | 秋秋音乐-1.2.1-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.2.1/1.2.1-windows-x64.zip) | 秋秋音乐-1.2.1-windows-x64.exe |

### v1.1.0

桌面版将界面、后端、基础曲库和静态资源全部打包，本地运行，不再依赖 Render 网站。首页断网可打开，已缓存音频可离线播放；在线搜索、榜单更新及未缓存音频仍需连接外部音源。首次升级自动迁移旧桌面版的歌单、收藏、主题和播放进度。架构、数据位置及缓存限制见[桌面端说明](desktop/README.md)。

安装包位于 `desktop/dist/1.1.0/`，目录只保留 macOS Apple / Intel DMG 及 Windows x64 EXE。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.1.0/1.1.0-macos-arm64.zip) | 秋秋音乐-1.1.0-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.1.0/1.1.0-macos-x64.zip) | 秋秋音乐-1.1.0-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.1.0/1.1.0-windows-x64.zip) | 秋秋音乐-1.1.0-windows-x64.exe |


### v1.0.10

- 悬浮窗口不抢系统焦点；清除点击高亮及快捷按钮背景模糊合成，保持圆周外透明。
- 电脑网页顶栏新增“下载桌面版”：Windows 直接匹配，Mac 能识别芯片时直接匹配，无法识别时可选 Apple / Intel 包。手机和平板及原生客户端隐藏此入口。
- 网页下载入口自动读取 GitHub 最新正式版，暂时不可用时回退到 README 当前版本链接；下载 ZIP 后请先解压。

正式安装包位于 `desktop/dist/1.0.10/`，仅保留以下三个文件。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.10/1.0.10-macos-arm64.zip) | 秋秋音乐-1.0.10-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.10/1.0.10-macos-x64.zip) | 秋秋音乐-1.0.10-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.10/1.0.10-windows-x64.zip) | 秋秋音乐-1.0.10-windows-x64.exe |

### v1.0.9

悬浮播放器移除外圈进度底色，仅显示已播放的珊瑚色弧线；加粗弧线，0% 时完全隐藏。已验证深浅背景和 0%、25%、50%、100% 的透明像素表现。

正式安装包位于 `desktop/dist/1.0.9/`，目录仅保留以下三个文件。下载 ZIP 后解压安装。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.9/1.0.9-macos-arm64.zip) | 秋秋音乐-1.0.9-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.9/1.0.9-macos-x64.zip) | 秋秋音乐-1.0.9-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.9/1.0.9-windows-x64.zip) | 秋秋音乐-1.0.9-windows-x64.exe |

### v1.0.8

修复 macOS 点击悬浮窗口 × 后未完全退出、随后播放控制失效的问题；已验证关闭/重开主界面，以及连续暂停、恢复后的真实音频进度。正式站点恢复为 <https://qiuqiumusic.onrender.com/>。

正式安装包位于 `desktop/dist/1.0.8/`，仅保留以下三个文件。下载 ZIP 后解压安装。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.8/1.0.8-macos-arm64.zip) | 秋秋音乐-1.0.8-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.8/1.0.8-macos-x64.zip) | 秋秋音乐-1.0.8-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.8/1.0.8-windows-x64.zip) | 秋秋音乐-1.0.8-windows-x64.exe |

### v1.0.7

正式安装包位于 `desktop/dist/1.0.7/`，目录只保留两个 macOS DMG 和一个 Windows EXE。GitHub 下载使用 ZIP 保存中文名安装包，请先解压再安装。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.7/1.0.7-macos-arm64.zip) | 秋秋音乐-1.0.7-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.7/1.0.7-macos-x64.zip) | 秋秋音乐-1.0.7-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.7/1.0.7-windows-x64.zip) | 秋秋音乐-1.0.7-windows-x64.exe |

程序坞图标按 QQ、微信的图形占比调整，启动时刷新当前图标；菜单栏改为带音符的单色图标。悬停面板去掉整块底色，标题宽度随内容变化，文字描边和独立按钮底保证清晰可见。

### v1.0.6

本地正式安装包位于 `desktop/dist/1.0.6/`，该目录只保留两个 macOS DMG 和一个 Windows EXE；后续版本使用各自的版本号目录。

安装包统一命名为“秋秋音乐-版本号-系统-架构”。[GitHub 会过滤上传文件名中的中文](https://docs.github.com/en/rest/releases/assets)，因此此版本提供 ZIP 下载；请解压后运行其中的中文名安装包。

| 系统 | 下载 | ZIP 内的安装包 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.6/1.0.6-macos-arm64.zip) | 秋秋音乐-1.0.6-macos-arm64.dmg |
| macOS（Intel） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.6/1.0.6-macos-x64.zip) | 秋秋音乐-1.0.6-macos-x64.dmg |
| Windows（64 位） | [下载 ZIP](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.6/1.0.6-windows-x64.zip) | 秋秋音乐-1.0.6-windows-x64.exe |

### v1.0.5

| 系统 | 安装包 | 架构 |
| --- | --- | --- |
| macOS（Apple 芯片） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.5/qiuqiumusic-1.0.5-macos-arm64.dmg) | arm64 |
| macOS（Intel） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.5/qiuqiumusic-1.0.5-macos-x64.dmg) | x64 |
| Windows（64 位） | [下载安装程序](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.5/qiuqiumusic-1.0.5-windows-x64.exe) | x64 |

菜单栏使用独立的小尺寸单色图标，程序坞使用正常大小的圆角图标。悬浮播放器支持悬停快捷切歌和播放/暂停，进度环采用珊瑚色；固定窗口尺寸减少悬停闪烁。

### v1.0.4

| 系统 | 安装包 | 架构 |
| --- | --- | --- |
| macOS（Apple 芯片，M1/M2/M3/M4） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.4/qiuqiumusic-1.0.4-macos-arm64.dmg) | arm64 |
| macOS（Intel） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.4/qiuqiumusic-1.0.4-macos-x64.dmg) | x64 |
| Windows（64 位） | [下载安装程序](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.4/qiuqiumusic-1.0.4-windows-x64.exe) | x64 |

本版本进一步缩小系统 Dock/任务栏图标；悬浮播放器的歌曲名改为半透明青绿色磨砂底，长标题会自动滚动显示。

### v1.0.3

| 系统 | 安装包 | 架构 |
| --- | --- | --- |
| macOS（Apple 芯片，M1/M2/M3/M4） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.3/qiuqiumusic-1.0.3-macos-arm64.dmg) | arm64 |
| macOS（Intel） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.3/qiuqiumusic-1.0.3-macos-x64.dmg) | x64 |
| Windows（64 位） | [下载安装程序](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.3/qiuqiumusic-1.0.3-windows-x64.exe) | x64 |

### v1.0.2

| 系统 | 安装包 | 架构 |
| --- | --- | --- |
| macOS（Apple 芯片，M1/M2/M3/M4） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.2/qiuqiumusic-1.0.2-macos-arm64.dmg) | arm64 |
| macOS（Intel） | [下载 DMG](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.2/qiuqiumusic-1.0.2-macos-x64.dmg) | x64 |
| Windows（64 位） | [下载安装程序](https://github.com/kevinq888/qiuqiumusic/releases/download/v1.0.2/qiuqiumusic-1.0.2-windows-x64.exe) | x64 |

全部版本的更新记录和安装包见 [GitHub Releases](https://github.com/kevinq888/qiuqiumusic/releases)。macOS 安装包尚未进行 Developer ID 签名和公证；首次打开时若系统拦截，请在“系统设置 → 隐私与安全性”中允许打开。

## 本地运行

需要 Node.js 22 或更新版本。

```sh
npm start
```

打开 <http://localhost:3000>。可设置环境变量 `PORT` 更换端口。

## 安装到手机桌面

本站也是可安装的网页 App（PWA），安装后会在手机主屏幕显示“秋秋音乐”。安卓 Chrome 可点击站点顶栏的“安装”并确认系统提示；iPhone 请在 Safari 使用“分享”→“添加到主屏幕”。微信等内置浏览器通常不提供系统安装提示，请先选择“在浏览器打开”，再使用 Chrome 或 Safari 安装。安装需要由手机系统确认。

## 公开部署

完整的部署步骤、Render 配置、缓存说明和排障方法见[部署指南](docs/DEPLOYMENT.md)。在线地址：[qiuqiumusic.onrender.com](https://qiuqiumusic.onrender.com/)。

完整站点需要运行 Node.js 服务。GitHub Pages 只发布静态文件，无法执行实时榜单抓取、搜索和音频代理。若需自行部署，请将仓库连接到支持 Node.js 或 Docker 的托管平台，并使用以下配置：

- 构建命令：`node --check server.js`（仅做语法检查，无 npm 依赖）
- 启动命令：`npm start`
- 监听端口：平台提供的 `PORT` 环境变量，默认 3000
- Docker：仓库根目录的 `Dockerfile`

仓库根目录的 `render.yaml` 配置了 Render Web Service，可通过 Render Blueprint 连接 GitHub 仓库。线上服务从 GitHub `kevinq888/qiuqiumusic` 的 `main` 分支部署；向仓库推送后，按 Render 服务的自动部署设置发布。Codeup 副本的提交不会更新 Render 服务。

免费实例闲置后可能休眠，首次访问需等待服务启动；实例重启或重新部署后，临时文件缓存可能需要重新抓取。若需跨重启保留缓存，可使用带持久化磁盘的服务计划。

站点从上游公开页面生成榜单和搜索结果。首次访问或六小时缓存过期后会重新获取，因此部署环境需要能访问上游站点。缓存写入 `data/cache/`；播放音频也依赖上游 CDN 可用。

## 仓库

GitHub：[kevinq888/qiuqiumusic](https://github.com/kevinq888/qiuqiumusic) · Codeup：[kevinq/qiuqiumusic](https://codeup.aliyun.com/6305f229e8ec152a05d73b41/kevinq/qiuqiumusic)。
