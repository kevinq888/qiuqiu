# 秋秋音乐（qiuqiumusic）

一个零 npm 依赖的 Node.js 音乐站。提供站内播放器、收藏和播放清单、可切换皮肤、推荐与热门榜单，以及在线搜索。收藏和播放清单保存在浏览器本地。

## 本地运行

需要 Node.js 22 或更新版本。

```sh
npm start
```

打开 <http://localhost:3000>。可设置环境变量 `PORT` 更换端口。

## 安装到手机桌面

本站是可安装的网页 App（PWA），安装后会在桌面显示“秋秋音乐”图标。安卓 Chrome 可点击站点顶栏的“安装”并确认系统提示；iPhone 需在 Safari 使用“分享”→“添加到主屏幕”。微信等应用内置浏览器不提供系统安装提示，先通过右上角菜单“在浏览器打开”，再安装；若没有该选项，可在站点安装指引中复制链接，粘贴到 Chrome 或 Safari。网页无法绕过手机系统的安装确认。

## 公开部署

完整的部署步骤、当前 Render 配置、缓存说明和排障方法见 [部署指南](docs/DEPLOYMENT.md)。当前线上地址：<https://qiuqiumusic.onrender.com/>。

代码可托管在 GitHub，但**完整站点需要运行 Node.js 服务**。GitHub Pages 只发布静态文件，无法执行本项目的实时榜单抓取、搜索和音频代理。若需要完整播放与搜索功能，请将 GitHub 仓库连接到支持 Node.js 或 Docker 的托管平台，使用以下配置：

- 构建命令：`node --check server.js`（仅做语法检查，无 npm 依赖）
- 启动命令：`npm start`
- 监听端口：平台提供的 `PORT` 环境变量，默认 3000
- Docker：仓库根目录的 `Dockerfile`

仓库根目录的 `render.yaml` 配置了 Render 免费 Web Service，可在首次部署时通过 Render Blueprint 连接 GitHub 仓库。当前线上服务从 GitHub `kevinq888/qiuqiu` 的 `main` 分支拉取代码；它通过公开仓库 URL 创建，推送后需在 Render 手动部署。Codeup 副本的提交不会更新线上服务。

免费实例闲置后会休眠，首次访问需要等待启动；文件系统在休眠或重新部署后重置，因此榜单和搜索缓存可能需要重新抓取。若需要稳定的持久缓存，可改用带持久化磁盘的服务计划。

站点读取上游公开页面生成榜单和搜索结果。首次访问或六小时缓存过期后会重新获取；运行环境需要能访问上游站点。缓存写入 `data/cache/`，生产环境如需跨重启保留缓存，请挂载持久化磁盘。播放音频同样依赖上游 CDN 可用。

## 仓库

GitHub 仓库：<https://github.com/kevinq888/qiuqiu>。Codeup 副本：<https://codeup.aliyun.com/6305f229e8ec152a05d73b41/kevinq/qiuqiu>。
