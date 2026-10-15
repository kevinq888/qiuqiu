# 秋秋音乐（qiuqiumusic）

一个零 npm 依赖的 Node.js 音乐站。提供站内播放器、收藏和播放清单、可切换皮肤、推荐与热门榜单，以及在线搜索。收藏和播放清单保存在浏览器本地。

## 本地运行

需要 Node.js 22 或更新版本。

```sh
npm start
```

打开 <http://localhost:3000>。可设置环境变量 `PORT` 更换端口。

## 公开部署

代码可托管在 GitHub，但**完整站点需要运行 Node.js 服务**。GitHub Pages 只发布静态文件，无法执行本项目的实时榜单抓取、搜索和音频代理。若需要完整播放与搜索功能，请将 GitHub 仓库连接到支持 Node.js 或 Docker 的托管平台，使用以下配置：

- 构建命令：无需构建（无 npm 依赖）
- 启动命令：`npm start`
- 监听端口：平台提供的 `PORT` 环境变量，默认 3000
- Docker：仓库根目录的 `Dockerfile`

仓库根目录的 `render.yaml` 配置了 Render 免费 Web Service，可通过 Render Blueprint 连接此仓库部署。服务会自动获得 `onrender.com` 地址，并在 `master` 分支更新时重新部署。

免费实例闲置后会休眠，首次访问需要等待启动；文件系统在休眠或重新部署后重置，因此榜单和搜索缓存可能需要重新抓取。若需要稳定的持久缓存，可改用带持久化磁盘的服务计划。

站点读取上游公开页面生成榜单和搜索结果。首次访问或六小时缓存过期后会重新获取；运行环境需要能访问上游站点。缓存写入 `data/cache/`，生产环境如需跨重启保留缓存，请挂载持久化磁盘。播放音频同样依赖上游 CDN 可用。

## 仓库

目标 GitHub 仓库：<https://github.com/ravinque/qiuqiu>。
